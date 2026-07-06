import { createRoot } from 'react-dom/client'
import { WherebyProvider } from '@whereby.com/browser-sdk/react'
import './index.css'
import App from './App.tsx'

// iOS Safari: pin the audio session to play-and-record, otherwise WebKit
// flips the session to playback-only once remote audio starts playing and
// OS-mutes the microphone capture (track.muted = true, unrecoverable from JS).
// Safari 16.4+; other browsers don't expose navigator.audioSession.
const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
if (audioSession) {
  try {
    audioSession.type = 'play-and-record'
  } catch {
    // best effort — older Safari may reject unknown types
  }
}

// No StrictMode: its dev-mode double effect invocation makes the SDK
// join/leave the room twice, which breaks the knock flow.
createRoot(document.getElementById('root')!).render(
  <WherebyProvider>
    <App />
  </WherebyProvider>,
)
