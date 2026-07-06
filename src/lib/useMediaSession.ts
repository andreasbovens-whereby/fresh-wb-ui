import { useEffect, useRef } from 'react'

interface MediaSessionOptions {
  active: boolean
  roomUrl: string
  isMicrophoneEnabled: boolean
  isCameraEnabled: boolean
  onToggleMicrophone: () => void
  onToggleCamera: () => void
  onHangup: () => void
}

// The video-conferencing extensions aren't in TS's lib.dom yet
type VcMediaSession = MediaSession & {
  setMicrophoneActive?: (active: boolean) => void
  setCameraActive?: (active: boolean) => void
}
type VcAction = MediaSessionAction | 'togglemicrophone' | 'togglecamera' | 'hangup'

function getMediaSession(): VcMediaSession | undefined {
  return 'mediaSession' in navigator ? (navigator.mediaSession as VcMediaSession) : undefined
}

function setHandler(session: MediaSession, action: VcAction, handler: (() => void) | null) {
  try {
    session.setActionHandler(action as MediaSessionAction, handler)
  } catch {
    // Browser doesn't know this action — fine, it's progressive enhancement
  }
}

/**
 * Surfaces the call in the OS media UI (lock screen, Dynamic Island, PiP
 * overlays): metadata naming the room, mute/camera/hang-up controls routed to
 * our actions, and capture-state sync via setMicrophoneActive/setCameraActive.
 * Everything is feature-detected — unsupported browsers ignore it.
 */
export function useMediaSession({
  active,
  roomUrl,
  isMicrophoneEnabled,
  isCameraEnabled,
  onToggleMicrophone,
  onToggleCamera,
  onHangup,
}: MediaSessionOptions) {
  // Keep handlers fresh without re-registering on every render
  const callbacks = useRef({ onToggleMicrophone, onToggleCamera, onHangup })
  callbacks.current = { onToggleMicrophone, onToggleCamera, onHangup }

  useEffect(() => {
    const session = getMediaSession()
    if (!session || !active) return

    let roomName = 'Video call'
    try {
      roomName = decodeURIComponent(new URL(roomUrl).pathname.replace(/^\//, '')) || roomName
    } catch {
      // keep fallback title
    }
    session.metadata = new MediaMetadata({
      title: roomName,
      artist: 'Fresh · Whereby',
    })

    setHandler(session, 'togglemicrophone', () => callbacks.current.onToggleMicrophone())
    setHandler(session, 'togglecamera', () => callbacks.current.onToggleCamera())
    setHandler(session, 'hangup', () => callbacks.current.onHangup())

    return () => {
      setHandler(session, 'togglemicrophone', null)
      setHandler(session, 'togglecamera', null)
      setHandler(session, 'hangup', null)
      session.metadata = null
    }
  }, [active, roomUrl])

  // Tell the OS UI what the real capture state is
  useEffect(() => {
    const session = getMediaSession()
    if (!session || !active) return
    try {
      session.setMicrophoneActive?.(isMicrophoneEnabled)
      session.setCameraActive?.(isCameraEnabled)
    } catch {
      // progressive enhancement
    }
  }, [active, isMicrophoneEnabled, isCameraEnabled])
}
