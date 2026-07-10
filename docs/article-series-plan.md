# Article series plan: "Building custom video calling experiences with the Whereby SDK and Claude"

Planning doc for a series of articles walking through this repo's build, article by
article, with this repo (or a branch/tag per article) as the accompanying code.
Not for publication — reference for generating the actual articles later.

Series premise: rather than one big finished repo, build it up in the same order
it was actually built, one working milestone at a time, so each article ends
with something real and runnable.

## Structure

Articles 1–4 are linear (each builds on the previous). Articles 5–8 all branch
independently off article 4's end state, so they can be read/built in any order
— they don't depend on each other.

```
1 (premise + basic room) → 2 → 3 → 4 ("core experience" complete)
                                       ├─ 5 (transcription)
                                       ├─ 6 (Document PiP)
                                       ├─ 7 (Media Session + mic watchdog)
                                       └─ 8 (whiteboard)
                                              ↓
                                              9 (tour of the finished app)
```

---

## Article 1 — Premise + basic room experience

Premise: the paste-a-Whereby-URL approach — no backend, no credentials — the
app only ever consumes a room URL created elsewhere (e.g. via the Whereby
Embedded REST API). Why the URL rides in the `#url=` fragment, not a `?url=`
query param: fragments never hit the wire (not sent in HTTP requests, not
logged in server access logs, not leaked via `Referer`), which matters
because the room URL contains the room's auth key. Combine with a
`no-referrer` policy meta tag.

Scope: join a call, see video tiles, mute/unmute cam+mic, leave. Mobile-friendly
from the start, not retrofitted later.

- **Join form**: paste-a-URL input, localStorage-backed recent-rooms list
  (10 max, dedup on re-use, per-entry remove).
- **Pre-join lobby**: camera preview (mirrored only for front-facing cameras —
  don't mirror rear cameras), camera/mic/speaker device pickers, a speaker
  test tone, mute/camera toggles before joining, remembered display name.
  - The iOS quirk: `getUserMedia` can silently fall back to camera-only when
    audio acquisition fails — no error, no prompt, `currentMicrophoneDeviceId`
    just stays undefined. Detect this and offer an explicit "enable
    microphone" action rather than letting someone join with a dead mic and
    not know it.
- **Knock flow**: visitor room links don't join directly — the SDK reports
  `connectionStatus === 'room_locked'`, the client calls `knock()`, and then
  waits on a "waiting for the host" screen until `connectionStatus` flips to
  `connected`. Hosts need the reciprocal side: an admit/deny toast for waiting
  participants.
- **Responsive video grid**: 1–2 tiles stack in portrait, sit side-by-side in
  landscape; larger calls form a grid capped at 2 columns on phones.
- **Deployment note** (closing section): get this basic version live before
  moving on.
  - `npm run build` → static `dist/` output, deployable to any static host.
  - GitHub Pages specifics: set Vite's `base` config for a project site
    (served at `/<repo>/`, not `/`), and a GitHub Actions workflow to build +
    publish on push.
  - Nothing in this milestone needs a backend of any kind (that only comes up
    in article 8, for the whiteboard's WebSocket relay).

## Article 2 — Chat + people sidebar

Scope: slide-in sidebar with chat and a participant list.

- Sidebar behavior: side column on desktop, overlay over the tiles on mobile
  (keeps header/toolbar visible underneath), unread-message badge.
- People tab: participant list with mute/camera-state indicators.
- **Emoji, as a small added feature**:
  - `:shortcode:` → emoji conversion, live as you type, using a real compiled
    dataset (`gemoji`, pulled in at authoring time — not hand-curated) rather
    than random cheat-sheet gists (which turned out to be incomplete/stale —
    worth mentioning why a canonical, actively-maintained source mattered).
  - Autocomplete popup while typing a partial shortcode: ranked matches,
    arrow-key navigation, Enter/Tab to accept, Escape to dismiss.
  - A lone-emoji message renders large and bubble-free with a small bounce-in
    animation, instead of sitting in a normal chat bubble.

## Article 3 — Screensharing

Scope: share your screen/window/tab, see others' shares.

- Featured-stage + filmstrip layout while a screenshare is active.
- Hide the button entirely on platforms without `getDisplayMedia` (iOS).
- **Captured Surface Control** as a Chromium-only enhancement: when sharing a
  browser tab specifically (not a window/screen), show scroll/zoom controls
  on your own local preview that let you manipulate the shared tab without
  switching to it.
  - The SDK's `startScreenshare()` calls `getDisplayMedia` internally with no
    way to pass options — worth explaining the one-shot monkey-patch of
    `navigator.mediaDevices.getDisplayMedia` used to inject a
    `CaptureController` right before the SDK's own call, and why that's the
    only available hook given the SDK doesn't expose one.

## Article 4 — Polish: tile behavior + backgrounds + button styling

This is the one that "concludes" the core experience — after this, the app
looks and feels finished, even before transcription/PiP/whiteboard exist.

- **Focus view**: double-click a tile to feature it (large, left) with
  everyone else in a filmstrip; double-click again to restore. Animated with
  the View Transitions API, with a plain instant-swap fallback where it's
  unsupported or `prefers-reduced-motion` is set.
- **Custom backgrounds**: a settings dropdown (photo or flat color) behind the
  tiles. Deliberately local-only/not synced to other participants — worth a
  short aside on why (a real design decision made and explained, not an
  oversight).
- **Frosted toolbar buttons**: when a custom background is active, buttons
  switch to a translucent `backdrop-filter: blur()` look.
  - **The debugging story**: a real Chrome rendering bug surfaced here —
    hovering one frosted button left a stale seam/artifact on a *different*
    button, persisting until the window was resized. Worth telling this as
    its own mini-narrative:
    1. First reduced-test-case attempt (hand-translated Tailwind classes to
       plain CSS) didn't reproduce it — turned out Tailwind v4's
       `color-mix()`-based colors mattered, not just the visual result.
    2. Second attempt hand-pruned the *real* compiled CSS down to "classes
       that look used," which silently dropped Tailwind's `@property`
       registrations (the block that gives `--tw-border-style`,
       `--tw-shadow-color`, etc. their initial values) — broke borders/shadows
       *and* stopped the bug from reproducing, a full wasted round-trip.
    3. Working repro: pull a fresh compiled stylesheet straight from
       `npx vite build --minify false`, trim only the HTML, never hand-prune
       the CSS.
    4. Root cause, found only once the repro was trustworthy again: a
       `.fade-in` transform/opacity entrance animation applied to an
       *ancestor* of the frosted buttons. Removing it (only from that one
       ancestor — the animation is used elsewhere in the app where it's
       harmless) fixed it.
  - Good illustration of "the fix was one CSS class, but getting a reliable
    repro was most of the actual work."

## Article 5 — Live transcription (branches from 4)

This one has more real narrative than "add a transcript panel" implies — worth
leaning into the sequence of attempts, not just presenting the final design.

- The toolbar toggle calls the SDK's `startLiveCaptions()`/`stopLiveCaptions()`
  and accumulates the streamed caption text into a persistent transcript
  (the SDK's own `captionLog` prunes entries ~5s after they finalize and wipes
  on stop/reconnect — the app has to keep its own copy to survive that).
- Transcript bubbles interleave with chat, speaker-labeled, with a copy button
  that exports whatever's in view.
- **The sync problem and how it was actually solved**:
  1. First cut: only the person who clicked the toolbar button saw the icon
     go green — `liveCaptions` turned out to be a **per-client subscription**,
     not room-broadcast. Starting it on one client never surfaces caption
     text *or* an active status on anyone else's connection, confirmed by
     testing with two participants.
  2. First fix attempt: also call the SDK's separate `startLiveTranscription()`
     feature (which genuinely *is* room-broadcast) purely as a shared on/off
     flag. Rejected — triggering a second, unrelated Whereby feature just to
     piggyback on its broadcast side-effect risks unknown consequences (plan
     restrictions, meeting-transcript generation) that can't be verified from
     the client SDK alone.
  3. Actual fix: broadcast a **hidden marker chat message**
     (`​​wb-transcription:on`/`off`, prefixed with zero-width spaces so it can
     never collide with real user text — chosen over a NUL-byte prefix, which
     risks being silently stripped by some chat storage layers) over the
     room's existing chat channel. Filtered out of the visible chat, unread
     badge, and transcript export.
  4. **A race condition this introduced**: the optimistic "I just clicked
     stop" UI override was releasing as soon as the SDK's own captions status
     confirmed stopped — but chat messages (including your own) only become
     visible locally after a full server round trip, no local echo. So the
     override could let go *before* the "off" marker had actually landed,
     and the toolbar would flip back to "on," reading the stale previous
     marker. Fix: only release the override once *both* signals agree.
  5. **A follow-up gap**: each viewer needs their own `startLiveCaptions()`
     subscription to see the actual transcript *content* (the per-client
     limitation from step 1 doesn't go away just because the shared icon
     now syncs) — wired to the "Show transcript" checkbox, lazily
     starting/stopping that viewer's own subscription, independent of the
     shared toolbar toggle.
  6. **The late-joiner edge case**: a marker sent before someone joins the
     call never reaches them — chat history from before a client connects
     doesn't replay (confirmed by reading the SDK's chat reducer: it only
     accumulates messages received after connecting, no room-join-payload
     history sync, unlike some other room state). Fix: whoever's already in
     the call and already knows transcription is active re-broadcasts the
     "on" marker the moment they notice a new participant join.
- Good closing point: five real bugs/gaps across one feature, each only found
  by testing with actual multiple participants — a reminder that anything
  "shared state across clients" needs multi-client testing, not just solo
  click-through.

## Article 6 — Document Picture-in-Picture (branches from 4)

- Feature-detected, Chrome/Edge only.
- Duplicates the tile grid into a real floating window using fresh `<video>`
  elements bound to the *same* MediaStreams (muted, so audio doesn't double)
  — rather than pausing/hiding the main UI, which is the more common
  (worse) approach.
- Manual toggle, plus auto-opens on starting a screenshare and via Chrome's
  video-conferencing auto-PiP hook (tab-switch mid-call).

## Article 7 — Media Session + mobile/iOS behaviors (branches from 4)

- **Media Session API**: lock-screen/system-UI call controls (mute, hang up)
  on mobile.
- **Camera auto-pause**: mobile OSes suspend camera capture when the browser
  is backgrounded — signal camera-off (show an avatar) instead of leaving
  everyone else looking at a frozen frame, and resume on return.
- **Audio session pinned to `play-and-record`**: keeps the mic alive while
  remote audio is playing. Note the platform-level caveat: iOS still
  suspends a backgrounded Safari tab entirely if the mic is *unmuted* —
  that's an OS policy the app can't work around, not a bug.
- **The mic watchdog**: recovers from two distinct, confirmed SDK/browser
  quirks:
  1. The "OS-muted track" condition — iOS can silently mute the actual mic
     track at the system level without the app knowing.
  2. The "mic never acquired" condition from article 1's lobby detection,
     if it recurs mid-call — recovering requires an explicit
     `getUserMedia({audio:true})` + `setMicrophoneDevice()` + a full room
     rejoin, because a new audio track can't be added to a live RTC
     connection (only `replaceTrack`, and there's no existing audio track to
     replace if the mic was never live in the first place).
  - Worth noting the one public lever available to force a stream
    re-acquisition at all: toggling low-data mode (which triggers the SDK's
    internal stream-switch path) — with a ≥2s space between toggles, since
    concurrent `getUserMedia` calls race on iOS.

## Article 8 — Shared whiteboard (branches from 4)

- Excalidraw, lazy-loaded (~550KB chunk, only fetched when the board opens).
- Sync architecture: a tiny in-memory WebSocket relay (not a CRDT/OT
  library) — elements diffed by `(id, version)`, merged via Excalidraw's own
  `reconcileElements`, with a periodic full-scene "heal" broadcast to correct
  rare reconcile ties and keep late-joiners' snapshot complete.
- Live named cursors via Excalidraw's `collaborators` API, throttled pointer
  broadcasts.
- Session-scoped contents: wiped a minute after the last participant leaves
  the board.
- **Deployment**: the one piece of this whole app that needs a real backend
  process (a WebSocket server can't live on a static host). Walk through
  deploying `relay-server.ts` standalone — e.g. Render's free tier (New →
  Web Service → this repo, build `npm ci`, start `npm run relay`), wiring the
  resulting URL into the static build via `VITE_WHITEBOARD_WS_URL`. Note the
  free-tier cold-start caveat (~30–60s to wake after being idle) and that
  everything else in the app keeps working with no relay configured at all
  — the whiteboard is the only feature that needs it.

## Article 9 — Tour of the finished app

- Feature the complete, integrated experience end to end.
- Good place for a short "what didn't make it" or "what we tried and
  reverted" aside if there's a good one on hand (e.g. an experiment that got
  built, then fully undone once a real architectural limitation surfaced) —
  shows engineering judgment, not just a highlight reel. Optional, only if a
  clean example exists.

---

## Open ideas — flagged, not yet confirmed

Raised during planning but not yet decided on:

- **A meta-article about the human+AI collaboration process itself**, separate
  from any single feature — the actual back-and-forth: turns where a fix was
  wrong and got corrected, why a "confirm before implementing" norm emerged,
  how debugging methodology mattered (e.g. building reduced test cases from
  real compiled build output rather than hand-reconstructing them). Given the
  series title credits Claude explicitly, this could be the actual
  differentiator versus a generic Whereby tutorial — worth deciding whether
  it's its own piece or a thread woven through the others.
- **A standalone "confirmed SDK quirks" reference/appendix** — independent of
  which article it's attached to, there's a real accumulated list (mute
  inversion, mic silent-fail-to-camera-only, `liveCaptions` per-client
  scoping, no exposed connection-quality API, chat `parentId` reply support
  existing at the data level with no UI, etc.) that stands alone as a useful
  cheat-sheet.
