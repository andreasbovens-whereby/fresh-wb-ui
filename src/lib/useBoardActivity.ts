import { useEffect, useMemo, useRef, useState } from 'react'
import { roomNameFromUrl, whiteboardRelayUrl } from './relayUrl'

/** How long after the last drawing/pointer message the board counts as active */
const ACTIVITY_WINDOW_MS = 4000
const RECONNECT_DELAY_MS = 3000

/**
 * Listens silently on the whiteboard relay while the local board is closed,
 * reporting whether someone else is actively using the board (drawing or
 * moving their cursor). Heal/catch-up broadcasts are flagged by the sender
 * and ignored, so merely having the board open doesn't count as activity.
 *
 * Side benefit: this keeps a relay client connected for the whole call, so
 * the relay's session-expiry grace only starts when people actually leave.
 */
export function useBoardActivity(roomUrl: string, enabled: boolean): boolean {
  const [active, setActive] = useState(false)
  const activityTimer = useRef<number | undefined>(undefined)

  const roomName = useMemo(() => roomNameFromUrl(roomUrl), [roomUrl])

  useEffect(() => {
    if (!enabled) {
      setActive(false)
      return
    }

    let disposed = false
    let socket: WebSocket | undefined
    let reconnectTimer: number | undefined

    function connect() {
      if (disposed) return
      socket = new WebSocket(whiteboardRelayUrl(roomName))
      socket.onmessage = (event) => {
        let message: { type?: string; heal?: boolean }
        try {
          message = JSON.parse(String(event.data))
        } catch {
          return
        }
        const isActivity =
          (message.type === 'elements' && !message.heal) || message.type === 'pointer'
        if (!isActivity) return
        setActive(true)
        window.clearTimeout(activityTimer.current)
        activityTimer.current = window.setTimeout(() => setActive(false), ACTIVITY_WINDOW_MS)
      }
      socket.onclose = () => {
        // Dev-server restarts drop the socket — keep listening
        if (!disposed) {
          reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS)
        }
      }
    }

    connect()
    return () => {
      disposed = true
      window.clearTimeout(reconnectTimer)
      window.clearTimeout(activityTimer.current)
      setActive(false)
      socket?.close()
    }
  }, [roomName, enabled])

  return active
}
