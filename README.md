# Fresh Whereby UI

Internal testing tool: a modern alternative frontend for Whereby Embedded
meetings, built on `@whereby.com/browser-sdk` (React hooks). Paste any host or
visitor room URL created through the Whereby Embedded API and join with a
custom UI instead of the default embedded experience.

## Run it

```sh
npm install
npm run dev
```

The dev server binds to the LAN over HTTPS (self-signed cert — accept the
browser warning once per device), so you can test from a phone at
`https://<your-host>.local:5173`. HTTPS is required: `getUserMedia` only works
in secure contexts.

## Features

### Joining
- **Join form** with a localStorage-backed list of the 10 most recent room
  URLs (per-entry remove, dedupe on re-use).
- **Deep links**: `https://localhost:5173/#url=<roomUrl>` skips the form.
  Unencoded room URLs work too; legacy `?url=` links are migrated to the
  fragment form. Fragments never hit the wire, so roomKeys stay out of HTTP
  requests and referrers (the page also sets a `no-referrer` policy).
- **Pre-join lobby**: camera preview (mirrored only for front cameras),
  camera/mic/speaker pickers, speaker test sound, mute/camera toggles, display
  name (remembered). Detects the iOS case where the mic silently fails to
  initialize and offers an explicit permission request before you join silent.
- **Knock flow**: visitor links get a "waiting for the host" screen; hosts see
  an admit/deny toast for waiting participants.

### In-call
- **Responsive video grid**: 1–2 tiles stack in portrait and sit side-by-side
  in landscape; larger calls form a grid (max 2 columns on phones). Tiles cap
  at 16:9 and stay packed together, with leftover space outside the grid.
- **Focus view**: double-click a tile to feature it on the left with everyone
  else in a filmstrip; double-click again to restore. Animated with the View
  Transitions API where supported.
- **Screensharing** (hidden on devices without `getDisplayMedia`, e.g. iOS)
  with a featured stage + filmstrip layout and an explicit stop control.
- **In-call device switching**: chevron popouts on the Cam/Mic buttons for
  cameras, microphones, and speakers.
- **Chat + people panel**: slide-in sidebar (overlay over the tiles on mobile,
  keeping header and toolbar in place), unread badge.
- **Live transcription**: toolbar toggle backed by the SDK's live-captions
  API. Transcript bubbles interleave with chat (violet, speaker-labeled),
  persist for the whole call — including across reconnects — and a copy
  button exports whatever is in view (`[time] name: text`).
- **Shared whiteboard**: Excalidraw (bundled locally, lazy-loaded ~550KB
  chunk) synced across participants via a tiny WebSocket relay with live
  named cursors. The Board toolbar button pulses when someone else is
  drawing. Contents are session-scoped: wiped a minute after the last
  participant leaves. No third-party services involved.
- **Connection resilience**: brief drops keep the room on screen behind a
  "reconnecting" banner (15s grace before giving up); mute state is re-synced
  on connect to work around an SDK inversion bug; a mic watchdog detects the
  iOS "OS-muted track" condition and recovers automatically or via a fix
  banner.
- **Mobile/iOS behaviors**: audio session pinned to `play-and-record` (keeps
  the mic alive when remote audio plays), camera auto-pauses on app switch
  (others see your avatar instead of a frozen frame) and resumes on return,
  Media Session lock-screen call controls. Note: iOS suspends backgrounded
  Safari pages unless the mic is unmuted — that's platform policy.

## Architecture notes

- `src/components` — screens and UI (JoinForm → PreJoinLobby → Call →
  CallRoom; SidePanel, Toolbar, WhiteboardStage, …).
- `src/lib` — the workaround/feature hooks (mic watchdog, camera auto-pause,
  whiteboard sync, media session, …). Several encode confirmed SDK quirks;
  see code comments for the details and upstream-report candidates.
- `whiteboardRelay.ts` — in-memory WebSocket relay for the whiteboard,
  attached to the Vite dev server (same port/TLS) and exportable for
  standalone use (`relay-server.ts`, `npm run relay`).
- No credentials anywhere: the app only consumes room URLs created elsewhere
  (e.g. via the Whereby Embedded REST API) and talks to Whereby directly from
  the browser.

## Deployment

The app builds to static files (`npm run build` → `dist/`), so any static
host with HTTPS works — including GitHub Pages — with one caveat: the
whiteboard relay is a WebSocket server and needs a home of its own.

1. **Static app**: set Vite's `base` if deploying under a subpath (GitHub
   Pages project sites serve at `/<repo>/`), then publish `dist/`.
2. **Whiteboard relay**: run `npm run relay` (or `PORT=… node relay-server.ts`,
   Node 23+) on any small host behind a TLS proxy, and build the app with
   `VITE_WHITEBOARD_WS_URL=wss://<relay-host>/whiteboard-ws npm run build`.
   Without a relay URL, everything except whiteboard sync still works.

Everything else (calls, chat, transcription, knocking) talks directly to
Whereby's infrastructure from the browser and needs no backend.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · @whereby.com/browser-sdk v3 ·
@excalidraw/excalidraw · ws
