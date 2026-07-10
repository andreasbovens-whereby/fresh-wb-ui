# Building custom video calling experiences with the Whereby SDK: the basic room

## What we're building

A fully custom, responsive room UI for Whereby Embedded, built with the
`@whereby.com/browser-sdk` React hooks instead of the default embedded
iframe. This app doesn't create rooms itself. It takes a room URL that
already exists, created through the Whereby REST API or through the room
wizard in your Whereby dashboard, and turns it into a real meeting
experience.

For this first milestone, the flow is simple:

1. A join form where you paste a room URL.
2. A pre-join lobby: camera preview, device pickers, your name.
3. For visitor links, a knock screen: wait for the host to let you in.
4. The meeting room itself: video tiles, mute/unmute, leave.

By the end of this article, all four of those work, on desktop and on a
phone.

## The stack

- Vite, React, TypeScript
- Tailwind CSS v4
- `@whereby.com/browser-sdk`'s React hooks (`useLocalMedia`,
  `useRoomConnection`, `VideoView`)
- No backend at all. The app only ever consumes a room URL, it never
  creates one.

## Local first, then HTTPS for iOS

Most of this can be built and tested against a plain local dev server on
`localhost`. Browsers treat `http://localhost` as a special case and allow
camera/mic access there even without HTTPS, so desktop testing works out
of the box.

Testing on an iPhone is different. To open the app from your phone, you
connect to your MacBook over Wi-Fi, using its `.local` address, something
like `https://your-macbook.local:5173`. Camera and mic access still
require a secure connection, and that localhost exemption doesn't apply to
a `.local` address or an IP address. So the dev server needs to run over
HTTPS from the start (a self-signed certificate is enough) if you ever
want to test on a real phone.

This isn't a deploy step, it's just how the dev server runs locally. Set
it up once, and both desktop and iOS testing work from the same running
server.

## The prompt

Paste this into Claude Code (or claude.ai) as your first message, in a
fresh project folder, and it will scaffold the whole thing:

> Build a custom video calling web app on top of Whereby Embedded, using
> the `@whereby.com/browser-sdk` React hooks (`useLocalMedia`,
> `useRoomConnection`, `VideoView`) instead of the default embedded
> iframe.
>
> **Stack**: Vite, React, TypeScript, Tailwind CSS v4 (via
> `@tailwindcss/vite`), dark UI by default. No backend of any kind, this
> app only ever joins a room URL that was created elsewhere.
>
> **Dev server**: run over HTTPS (a self-signed cert is fine, e.g.
> `@vitejs/plugin-basic-ssl`) and bind to all network interfaces, not just
> localhost, so it can be reached from a phone on the same Wi-Fi network.
> Camera and mic access require a secure connection, and that requirement
> isn't waived for a LAN or `.local` address the way it is for plain
> `localhost`.
>
> **Accepting a room URL**: Whereby room URLs contain a `roomKey` that
> works like a password, anyone with the full URL can join. Accept room
> links after a `#` in the address (`yourapp.com/#url=<roomUrl>`), not as
> a `?url=` query parameter, since fragments never get sent to a server or
> written to a log while query strings do. Add a no-referrer meta tag
> too. On load, read the room URL from the fragment and skip straight to
> the lobby if one's there.
>
> **Join form**: a single input for pasting a room URL, a Continue button,
> and basic validation (it needs to be a real URL with a room name in the
> path). Remember the last 10 room URLs joined in localStorage, most
> recent first, deduplicated on reuse, and show them as a dropdown under
> the input with a small remove button per entry.
>
> **Pre-join lobby**: before joining, show a live camera preview,
> mute/camera toggles, camera/mic/speaker device pickers, a button that
> plays a short test tone through the speaker, and a name field remembered
> across visits. Keep `useLocalMedia` mounted through the call itself so
> these choices carry over. Only mirror the camera preview for
> front-facing cameras, not a rear camera on a phone. Also handle this iOS
> quirk: `getUserMedia` can silently fail to get a microphone while the
> camera still works fine, no error, no prompt, just no audio. Detect when
> there's video but no live audio track, and show a banner with an
> "Enable microphone" button that asks for mic access again.
>
> **Knock flow**: Whereby has two kinds of room links, host links join
> immediately and visitor links wait for the host to let them in. Using
> `useRoomConnection`, when `connectionStatus` is `'room_locked'`, call
> `knock()` and show a waiting screen with a cancel button. When it
> becomes `'connected'`, drop into the call automatically. Handle
> `'knock_rejected'` as its own screen. On the host's side, show a small
> toast for anyone in `waitingParticipants`, with Admit/Deny buttons.
>
> **Video grid**: lay out video tiles differently depending on
> orientation, updating live as the window resizes or a phone rotates.
> Portrait: 1-2 people in a single column, 3+ in two columns. Landscape: 1
> person full-size, 2-4 in two columns, 5-9 in three, more than that in
> four.
>
> **Deployment**: add a GitHub Actions workflow that builds this and
> deploys it to GitHub Pages on every push to `main`. GitHub Pages serves
> project sites from a subpath, not the domain root, so set Vite's `base`
> config from an environment variable the workflow provides.

We built a reference version of this app from close to this exact prompt.
Once it's public we'll link the repo here, so you can compare notes or
just clone it directly.

A few details in that prompt aren't padding, each one heads off a mistake
Claude would otherwise make by default:

- Room URLs go in a `#` fragment, not a `?` query string, because the URL
  carries a `roomKey` that works like a password, and fragments never
  reach a server or a log.
- The iOS mic quirk (camera works, mic silently doesn't) and the
  front-camera-only mirroring are both things you'd only discover by
  testing on a real phone.
- The exact `connectionStatus` values (`room_locked`, `knock_rejected`,
  `connected`) are the strings the SDK itself uses for the knock flow,
  worth naming precisely rather than describing loosely.
- The grid's column counts per orientation are a design decision, not
  something "make it responsive" would land on by itself.

## Running it locally

```sh
npm install
npm run dev
```

Open the HTTPS URL it prints, accept the self-signed certificate warning
once, and try the join form and lobby on your laptop.

To test on an iPhone, find your Mac's `.local` address (it's usually
printed in the terminal output, or check System Settings > General >
Sharing for the local hostname), then open
`https://that-address:5173` in Safari on your phone. You'll get the same
certificate warning once there too, accept it, and you're testing on a
real device.

## Shipping it to GitHub Pages

Push the project to a GitHub repo. The workflow Claude generated as part
of the prompt above builds the app and deploys it to GitHub Pages on every
push to `main`, so from here it's mostly a few clicks:

1. Push your code to GitHub.
2. In the repo's Settings > Pages, set the source to "GitHub Actions."
3. Push to `main` and watch the workflow run in the Actions tab.
4. Visit the URL GitHub gives you, that's your app, live.

GitHub Pages serves a project site from a subpath
(`https://you.github.io/repo-name/`), not the domain root, which is why
the prompt above already asks for the build's base path to come from an
environment variable rather than being hardcoded.

## What's next

At this point you can paste a room URL, land in a lobby, join, see
everyone, mute yourself, and leave, on a phone or a desktop, deployed
somewhere real. Next up: a chat and participant sidebar, and, because it
turned out to be worth doing properly, real emoji support.
