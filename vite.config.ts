import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { whiteboardRelay } from './whiteboardRelay.ts'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites under /<repo>/ — the deploy workflow
  // sets VITE_BASE accordingly; local dev and generic hosts stay at /.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss(), basicSsl(), whiteboardRelay()],
  server: {
    // Expose on the LAN (e.g. https://air-m4.local:5173) so phones can join.
    // HTTPS is required: getUserMedia only works in secure contexts, and the
    // localhost exemption doesn't extend to LAN hostnames.
    host: true,
  },
})
