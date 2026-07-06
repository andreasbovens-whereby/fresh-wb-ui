import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CaptureUpdateAction, reconcileElements } from '@excalidraw/excalidraw'
import type { Collaborator, ExcalidrawImperativeAPI, SocketId } from '@excalidraw/excalidraw/types'
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile'
import { roomNameFromUrl, whiteboardRelayUrl } from './relayUrl'

const SEND_THROTTLE_MS = 150
const POINTER_THROTTLE_MS = 50
/** Periodic full-scene broadcast heals rare reconcile-tie divergence and keeps
 * the relay's late-joiner snapshot complete. */
const HEAL_INTERVAL_MS = 10_000

type RelayMessage =
  | { type: 'snapshot'; elements: OrderedExcalidrawElement[] }
  | { type: 'elements'; userId: string; elements: OrderedExcalidrawElement[]; heal?: boolean }
  | { type: 'pointer'; userId: string; username: string; x: number; y: number; button: 'down' | 'up' }
  | { type: 'leave'; userId: string }

export interface WhiteboardSync {
  connected: boolean
  onExcalidrawAPI: (api: ExcalidrawImperativeAPI) => void
  onChange: () => void
  onPointerUpdate: (payload: {
    pointer: { x: number; y: number; tool: 'pointer' | 'laser' }
    button: 'down' | 'up'
  }) => void
}

/**
 * Syncs an Excalidraw canvas across call participants through the dev
 * server's /whiteboard-ws relay. Elements are diffed by (id, version) and
 * merged with Excalidraw's own reconcileElements; cursors ride along as
 * throttled pointer messages rendered via the collaborators API.
 */
export function useWhiteboardSync(roomUrl: string, displayName: string): WhiteboardSync {
  const [connected, setConnected] = useState(false)
  const userId = useMemo(() => crypto.randomUUID(), [])
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  /** Last element version we've sent or applied, per element id — the diff baseline */
  const syncedVersions = useRef(new Map<string, number>())
  const collaborators = useRef(new Map<SocketId, Collaborator>())
  const pendingRemote = useRef<OrderedExcalidrawElement[]>([])
  const sendTimer = useRef<number | undefined>(undefined)
  const lastPointerSent = useRef(0)

  const roomName = useMemo(() => roomNameFromUrl(roomUrl), [roomUrl])

  const displayNameRef = useRef(displayName)
  displayNameRef.current = displayName

  const send = useCallback((message: object) => {
    const socket = socketRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
    }
  }, [])

  const applyRemoteElements = useCallback((remote: OrderedExcalidrawElement[]) => {
    const api = apiRef.current
    if (!api) {
      // Snapshot can arrive before Excalidraw mounts — buffer and flush later
      pendingRemote.current.push(...remote)
      return
    }
    for (const element of remote) {
      const known = syncedVersions.current.get(element.id)
      syncedVersions.current.set(element.id, Math.max(known ?? 0, element.version))
    }
    const reconciled = reconcileElements(
      api.getSceneElementsIncludingDeleted(),
      remote as unknown as RemoteExcalidrawElement[],
      api.getAppState(),
    )
    api.updateScene({ elements: reconciled, captureUpdate: CaptureUpdateAction.NEVER })
  }, [])

  const updateCollaborators = useCallback(() => {
    apiRef.current?.updateScene({ collaborators: new Map(collaborators.current) })
  }, [])

  /** Broadcast local changes; `all` sends the full scene (join/heal) */
  const broadcastElements = useCallback(
    (all = false) => {
      const api = apiRef.current
      if (!api) return
      const elements = api.getSceneElementsIncludingDeleted()
      const changed = all
        ? [...elements]
        : elements.filter((el) => syncedVersions.current.get(el.id) !== el.version)
      if (changed.length === 0) return
      for (const element of changed) {
        syncedVersions.current.set(element.id, element.version)
      }
      // Full-scene sends are catch-up/heal traffic, not user activity — the
      // flag lets closed-board listeners ignore them for the pulse signal.
      send({ type: 'elements', userId, elements: changed, heal: all })
    },
    [send, userId],
  )

  // Socket lifecycle — the hook only lives while the board is open
  useEffect(() => {
    const socket = new WebSocket(whiteboardRelayUrl(roomName))
    socketRef.current = socket

    socket.onopen = () => {
      setConnected(true)
      // Push whatever we drew while offline/before connecting
      broadcastElements(true)
    }
    socket.onclose = () => setConnected(false)
    socket.onmessage = (event) => {
      let message: RelayMessage
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (message.type === 'snapshot' || message.type === 'elements') {
        if ('userId' in message && message.userId === userId) return
        applyRemoteElements(message.elements)
      } else if (message.type === 'pointer') {
        if (message.userId === userId) return
        collaborators.current.set(message.userId as SocketId, {
          username: message.username,
          pointer: { x: message.x, y: message.y, tool: 'pointer' },
          button: message.button,
        })
        updateCollaborators()
      } else if (message.type === 'leave') {
        if (collaborators.current.delete(message.userId as SocketId)) {
          updateCollaborators()
        }
      }
    }

    const healTimer = window.setInterval(() => broadcastElements(true), HEAL_INTERVAL_MS)

    return () => {
      window.clearInterval(healTimer)
      window.clearTimeout(sendTimer.current)
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'leave', userId }))
      }
      socket.close()
      socketRef.current = null
    }
  }, [roomName, userId, applyRemoteElements, broadcastElements, updateCollaborators])

  const onExcalidrawAPI = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api
      if (pendingRemote.current.length > 0) {
        const buffered = pendingRemote.current
        pendingRemote.current = []
        applyRemoteElements(buffered)
      }
      updateCollaborators()
    },
    [applyRemoteElements, updateCollaborators],
  )

  const onChange = useCallback(() => {
    window.clearTimeout(sendTimer.current)
    sendTimer.current = window.setTimeout(() => broadcastElements(), SEND_THROTTLE_MS)
  }, [broadcastElements])

  const onPointerUpdate = useCallback<WhiteboardSync['onPointerUpdate']>(
    ({ pointer, button }) => {
      const now = Date.now()
      if (now - lastPointerSent.current < POINTER_THROTTLE_MS) return
      lastPointerSent.current = now
      send({
        type: 'pointer',
        userId,
        username: displayNameRef.current,
        x: pointer.x,
        y: pointer.y,
        button,
      })
    },
    [send, userId],
  )

  return { connected, onExcalidrawAPI, onChange, onPointerUpdate }
}
