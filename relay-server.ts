/**
 * Standalone whiteboard relay for deployments where the app is served as
 * static files (e.g. GitHub Pages) and the Vite dev server isn't running.
 *
 *   npm run relay          # listens on :8080
 *   PORT=9000 npm run relay
 *
 * Point the app at it via VITE_WHITEBOARD_WS_URL at build time, e.g.
 *   VITE_WHITEBOARD_WS_URL=wss://relay.example.com/whiteboard-ws npm run build
 *
 * Runs directly under Node 23+ (native TypeScript type-stripping). Plain
 * HTTP — put it behind a TLS-terminating proxy for wss:// in production.
 */
import { createServer } from 'node:http'
import process from 'node:process'
import { attachWhiteboardRelay } from './whiteboardRelay.ts'

const port = Number(process.env.PORT) || 8080
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' })
  response.end('whiteboard relay — connect via WebSocket at /whiteboard-ws\n')
})

attachWhiteboardRelay(server)
server.listen(port, () => {
  console.log(`whiteboard relay listening on :${port} (path /whiteboard-ws)`)
})
