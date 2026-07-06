/**
 * WebSocket URL for the whiteboard relay. Defaults to the same host that
 * serves the app (the Vite dev server hosts the relay in development). For
 * static deployments, point at a standalone relay (relay-server.ts) via
 * VITE_WHITEBOARD_WS_URL at build time, e.g. wss://relay.example.com/whiteboard-ws
 */
export function whiteboardRelayUrl(roomName: string): string {
  const base =
    (import.meta.env.VITE_WHITEBOARD_WS_URL as string | undefined) ??
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/whiteboard-ws`
  return `${base}?room=${encodeURIComponent(roomName)}`
}

export function roomNameFromUrl(roomUrl: string): string {
  try {
    return new URL(roomUrl).pathname.replace(/^\//, '') || 'default'
  } catch {
    return 'default'
  }
}
