import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal, flushSync } from 'react-dom'
import {
  VideoView,
  type RoomConnection,
  type RoomConnectionActions,
  type UseLocalMediaResult,
} from '@whereby.com/browser-sdk/react'
import VideoTile, { type TileParticipant } from './VideoTile'
import Toolbar from './Toolbar'
import SidePanel, { type PanelTab, type TranscriptEntry } from './SidePanel'
import WaitingParticipantsNotice from './WaitingParticipantsNotice'
import BackgroundSettings from './BackgroundSettings'
import { PeopleIcon, PipIcon, SettingsIcon, SpinnerIcon } from './icons'
import { useDocumentPip } from '../lib/useDocumentPip'
import { useCapturedSurfaceControl } from '../lib/useCapturedSurfaceControl'
import {
  BACKGROUND_IMAGES,
  loadBackground,
  saveBackground,
  type BackgroundChoice,
} from '../lib/backgrounds'
import { useMediaQuery } from '../lib/useMediaQuery'
import { useBoardActivity } from '../lib/useBoardActivity'
import type { MicProblem } from '../lib/useMicWatchdog'
import { encodeTranscriptionSignal, isTranscriptionSignal } from '../lib/transcriptionSignal'

// ~1MB chunk — load only when someone opens the board
const WhiteboardStage = lazy(() => import('./WhiteboardStage'))

interface CallRoomProps {
  roomUrl: string
  state: Omit<RoomConnection, 'events'>
  actions: RoomConnectionActions
  localMedia: UseLocalMediaResult
  transcript: TranscriptEntry[]
  isTranscribing: boolean
  onToggleTranscription: () => void
  reconnecting: boolean
  micProblem: MicProblem
  micBlocked: boolean
  onFixMicrophone: () => void
  onLeave: () => void
}

/** Columns in a landscape (16:9-ish) viewport; portrait caps at 2 and stacks pairs */
function landscapeColumns(count: number): number {
  if (count <= 1) return 1
  if (count <= 4) return 2
  if (count <= 9) return 3
  return 4
}

function portraitColumns(count: number): number {
  return count <= 2 ? 1 : 2
}

/** view-transition-name must be a CSS custom-ident — sanitize the participant id */
function tileTransitionStyle(participantId: string): CSSProperties {
  return { viewTransitionName: `tile-${participantId.replace(/[^a-zA-Z0-9_-]/g, '')}` }
}

/**
 * Runs a layout change inside a View Transition so tiles morph smoothly to
 * their new position/size. Falls back to an instant switch where the API is
 * missing or motion is reduced. flushSync makes React commit the new layout
 * within the transition's snapshot callback.
 */
function withViewTransition(update: () => void) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduceMotion && 'startViewTransition' in document) {
    document.startViewTransition(() => flushSync(update))
  } else {
    update()
  }
}

export default function CallRoom({
  roomUrl,
  state,
  actions,
  localMedia,
  transcript,
  isTranscribing,
  onToggleTranscription,
  reconnecting,
  micProblem,
  micBlocked,
  onFixMicrophone,
  onLeave,
}: CallRoomProps) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<PanelTab>('chat')
  const [seenChatCount, setSeenChatCount] = useState(0)
  const [boardOpen, setBoardOpen] = useState(false)
  // Double-clicked tile takes the stage; double-click again to restore the grid
  const [featuredId, setFeaturedId] = useState<string | null>(null)
  // While our board is closed, listen for others drawing so the Board button
  // can pulse an invitation to join in.
  const boardActivity = useBoardActivity(roomUrl, !boardOpen)
  const isMobile = useMediaQuery('(max-width: 767px)')

  function toggleFeatured(participantId: string) {
    withViewTransition(() =>
      setFeaturedId((current) => (current === participantId ? null : participantId)),
    )
  }

  // Custom background behind the tiles area (not the sidebar); when active,
  // header/toolbar controls switch to a frosted-glass look.
  const [background, setBackground] = useState<BackgroundChoice>(loadBackground)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const frosted = background !== null
  // Pill text over a custom background: brighten + shadow-anchor for
  // contrast against arbitrarily light or busy imagery.
  const pillText = frosted ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]' : 'text-zinc-200'

  // Document PiP popout: duplicates the participant tiles into a floating
  // window (main-window tiles keep playing — no Meet-style pause jank).
  const pip = useDocumentPip()

  function changeBackground(choice: BackgroundChoice) {
    setBackground(choice)
    saveBackground(choice)
  }

  const backgroundStyle: CSSProperties =
    background?.type === 'color'
      ? { backgroundColor: background.hex }
      : background?.type === 'image'
        ? {
            backgroundImage: `url(${BACKGROUND_IMAGES.find((i) => i.id === background.id)?.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : {}

  const participants: TileParticipant[] = useMemo(() => {
    const local: TileParticipant[] = state.localParticipant
      ? [
          {
            id: state.localParticipant.id,
            displayName: state.localParticipant.displayName || 'You',
            stream: state.localParticipant.stream,
            isAudioEnabled: state.isMicrophoneEnabled,
            isVideoEnabled: state.isCameraEnabled,
            isLocal: true,
          },
        ]
      : []
    const remotes = state.remoteParticipants
      .filter((p) => !p.isAudioRecorder)
      .map((p) => ({
        id: p.id,
        displayName: p.displayName || 'Guest',
        stream: p.stream,
        isAudioEnabled: p.isAudioEnabled,
        isVideoEnabled: p.isVideoEnabled,
        isLocal: false,
      }))
    return [...local, ...remotes]
  }, [state.localParticipant, state.remoteParticipants, state.isCameraEnabled, state.isMicrophoneEnabled])

  const featuredScreenshare = state.screenshares[0]
  // Sized to the screenshare's own aspect ratio (see .screenshare-frame in
  // index.css) so the tile shrink-wraps the video exactly — no letterbox bars.
  const [screenshareAspect, setScreenshareAspect] = useState(16 / 9)
  const screenshareVideoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    setScreenshareAspect(16 / 9) // reset until the new share's first resize event
  }, [featuredScreenshare?.id])
  useEffect(() => {
    // Deliberately NOT using VideoView's onVideoResize here: that callback
    // reports the video element's rendered CSS box size (clientWidth/Height)
    // via a ResizeObserver, debounced at exactly 1000ms — feeding that into
    // the CSS that controls the box's own size is circular. Each cycle's
    // sub-pixel rounding compounded into a slow, steady height shrink once
    // per second. The native 'resize' event instead fires only when the
    // video's true intrinsic resolution (videoWidth/videoHeight) changes,
    // which our own layout can never affect.
    const video = screenshareVideoRef.current
    if (!video || !featuredScreenshare?.stream) return
    function updateAspect() {
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        setScreenshareAspect(video.videoWidth / video.videoHeight)
      }
    }
    updateAspect() // metadata may already be loaded
    video.addEventListener('resize', updateAspect)
    return () => video.removeEventListener('resize', updateAspect)
  }, [featuredScreenshare?.stream])
  // Tolerates the featured participant leaving mid-call
  const featuredParticipant = participants.find((p) => p.id === featuredId)
  const isScreensharing =
    state.localScreenshareStatus === 'starting' || state.localScreenshareStatus === 'active'

  // Captured Surface Control: scroll/zoom the tab you're sharing from its own
  // preview, without switching to it. Chrome 136+ desktop, tab captures only.
  const csc = useCapturedSurfaceControl()
  const cscStreamId = featuredScreenshare?.isLocal ? featuredScreenshare.stream?.id : undefined
  useEffect(() => {
    if (featuredScreenshare?.isLocal && featuredScreenshare.stream) {
      csc.onShareStarted(featuredScreenshare.stream)
    }
    // Re-checks only when the local share's own stream actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cscStreamId])
  useEffect(() => {
    // Catches sharing stopped via the browser's own "Stop sharing" bar, not
    // just our button
    if (!isScreensharing) csc.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScreensharing])

  function startSharing() {
    // Must run before startScreenshare(): it monkey-patches getDisplayMedia
    // for that call's one-shot to inject a CaptureController, since the
    // SDK's action itself takes no options.
    csc.prepareNextShare()
    actions.startScreenshare()
    void pip.open() // so you still see people while presenting
  }

  function stopSharing() {
    actions.stopScreenshare()
    csc.reset()
  }
  // Excludes the hidden transcription-sync marker messages (see
  // transcriptionSignal.ts) from the visible chat, unread badge, and copy export.
  const visibleChatMessages = useMemo(
    () => state.chatMessages.filter((m) => !isTranscriptionSignal(m.text)),
    [state.chatMessages],
  )
  const chatVisible = panelOpen && panelTab === 'chat'
  const unreadChatCount = visibleChatMessages.length - seenChatCount

  // liveCaptions content is per-client — viewing the transcript sidebar
  // subscribes this client's own connection to it (see SidePanel.tsx's
  // ChatTab effect that calls this). Turning it on also broadcasts the
  // shared "on" marker, since opening the transcript is a legitimate way to
  // kick off transcription for the room (e.g. a participant who never used
  // the toolbar button). Turning it off does NOT send an "off" marker —
  // that only stops watching locally; transcription for the room keeps
  // running (and the toolbar icon stays green) until someone explicitly
  // stops it from the toolbar.
  const { startLiveCaptions, stopLiveCaptions, sendChatMessage } = actions
  const setOwnCaptions = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        startLiveCaptions()
        sendChatMessage(encodeTranscriptionSignal(true))
      } else {
        stopLiveCaptions()
      }
    },
    [startLiveCaptions, stopLiveCaptions, sendChatMessage],
  )

  function updatePanel(open: boolean, tab: PanelTab = panelTab) {
    // Entering or leaving the chat tab counts everything so far as read
    if ((open && tab === 'chat') || chatVisible) setSeenChatCount(visibleChatMessages.length)
    setPanelOpen(open)
    setPanelTab(tab)
  }

  function togglePanel(tab: PanelTab) {
    updatePanel(!(panelOpen && panelTab === tab), tab)
  }

  const sidePanel = (
    <SidePanel
      variant={isMobile ? 'overlay' : 'side'}
      tab={panelTab}
      onTabChange={(tab) => updatePanel(true, tab)}
      onClose={() => updatePanel(false)}
      chatMessages={visibleChatMessages}
      transcript={transcript}
      isTranscribing={isTranscribing}
      participants={participants}
      localParticipantId={state.localParticipant?.id}
      onSendMessage={actions.sendChatMessage}
      onSetOwnCaptions={setOwnCaptions}
    />
  )

  return (
    <div className="fade-in flex h-full">
      <div className="relative flex min-w-0 flex-1 flex-col" style={backgroundStyle}>
        <WaitingParticipantsNotice
          waitingParticipants={state.waitingParticipants}
          onAccept={actions.acceptWaitingParticipant}
          onReject={actions.rejectWaitingParticipant}
        />

        {reconnecting && (
          <div className="pop-in absolute top-16 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2 text-sm text-amber-300 backdrop-blur">
            <SpinnerIcon width="1em" height="1em" />
            Connection hiccup — reconnecting…
          </div>
        )}

        {micProblem && !reconnecting && (
          <div className="pop-in absolute top-16 left-1/2 z-20 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/15 py-1.5 pr-1.5 pl-4 text-sm text-amber-300 backdrop-blur">
            <span className="min-w-0">
              {micBlocked
                ? 'Microphone access is blocked — allow it via ᴀA in the address bar → Website Settings → Microphone, then reload'
                : micProblem === 'missing'
                  ? 'No microphone is connected to this call'
                  : 'Your microphone was silenced by the system'}
            </span>
            {!micBlocked && (
              <button
                type="button"
                onClick={onFixMicrophone}
                className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-300 active:scale-95"
              >
                {micProblem === 'missing' ? 'Enable mic' : 'Fix mic'}
              </button>
            )}
          </div>
        )}

        <header className="flex items-center justify-between px-5 py-3">
          <span
            className={`text-lg font-semibold tracking-tight ${
              frosted ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]' : ''
            }`}
          >
            Fresh <span className="text-brand-400">·</span> Whereby
          </span>
          <span className="flex items-center gap-2">
            <span
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm ${
                frosted
                  ? 'border border-white/25 bg-zinc-950/25 text-white backdrop-blur-[15px]'
                  : 'bg-zinc-900 text-zinc-300'
              }`}
            >
              <PeopleIcon />
              {participants.length}
            </span>
            {pip.supported && (
              <button
                type="button"
                onClick={() => (pip.pipWindow ? pip.close() : void pip.open())}
                aria-label={pip.pipWindow ? 'Close picture-in-picture' : 'Open picture-in-picture'}
                aria-pressed={Boolean(pip.pipWindow)}
                className={`flex items-center rounded-xl px-2.5 py-1.5 text-sm transition active:scale-95 ${
                  pip.pipWindow
                    ? frosted
                      ? 'border border-white/25 bg-brand-500/75 text-brand-950 backdrop-blur-[15px] hover:bg-brand-500/90'
                      : 'bg-brand-500 text-brand-950 hover:bg-brand-400'
                    : frosted
                      ? 'border border-white/25 bg-zinc-950/25 text-white backdrop-blur-[15px] hover:bg-zinc-950/45'
                      : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
              >
                <PipIcon />
              </button>
            )}
            <button
              ref={settingsButtonRef}
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-label="Settings"
              aria-expanded={settingsOpen}
              className={`flex items-center rounded-xl px-2.5 py-1.5 text-sm transition active:scale-95 ${
                frosted
                  ? 'border border-white/25 bg-zinc-950/25 text-white backdrop-blur-[15px] hover:bg-zinc-950/45'
                  : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
            >
              <SettingsIcon />
            </button>
          </span>
        </header>

        {settingsOpen && (
          <BackgroundSettings
            choice={background}
            onChange={changeBackground}
            onClose={() => setSettingsOpen(false)}
            anchorRef={settingsButtonRef}
          />
        )}

        {/* On mobile the panel overlays just this middle section, keeping the
            header above and the toolbar below visible and in place. */}
        <div className="relative min-h-0 flex-1">
          <main className="h-full px-4 pb-1">
            {boardOpen ? (
              <div className="fade-in flex h-full flex-col gap-3 lg:flex-row">
                <div className="min-h-0 flex-1">
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500">
                        <SpinnerIcon width="2em" height="2em" />
                      </div>
                    }
                  >
                    <WhiteboardStage
                      roomUrl={roomUrl}
                      displayName={state.localParticipant?.displayName || 'Guest'}
                    />
                  </Suspense>
                </div>
                <div className="panel-scroll flex shrink-0 gap-3 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto">
                  {participants.map((p) => (
                    <div key={p.id} className="aspect-video w-44 shrink-0 lg:w-full">
                      <VideoTile participant={p} frosted={frosted} />
                    </div>
                  ))}
                </div>
              </div>
            ) : featuredScreenshare ? (
              <div className="fade-in flex h-full flex-col gap-3 lg:flex-row">
                <div className="screenshare-frame relative flex min-h-0 flex-1 items-center justify-center">
                  {featuredScreenshare.stream ? (
                    <div
                      className={`screenshare-box relative overflow-hidden rounded-2xl bg-zinc-900 ${
                        frosted ? 'border border-white/25 shadow-[0_10px_30px_rgba(0,0,0,0.35)]' : ''
                      }`}
                      style={{ '--ar': screenshareAspect } as CSSProperties}
                    >
                      <VideoView
                        ref={(node) => {
                          screenshareVideoRef.current = node
                        }}
                        stream={featuredScreenshare.stream}
                        muted={featuredScreenshare.isLocal}
                      />
                      {featuredScreenshare.isLocal && (
                        <div
                          className={`pop-in absolute top-3 left-3 flex items-center gap-2 rounded-xl p-1.5 pl-3 ${
                            frosted
                              ? 'border border-white/25 bg-zinc-950/25 backdrop-blur-[15px]'
                              : 'bg-zinc-950/80 backdrop-blur'
                          }`}
                        >
                          <span className={`text-xs font-medium ${pillText}`}>
                            You are presenting
                          </span>
                          <button
                            type="button"
                            onClick={stopSharing}
                            className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-400 active:scale-95"
                          >
                            Stop sharing
                          </button>
                        </div>
                      )}
                      {featuredScreenshare.isLocal && csc.isTabCapture && (
                        <div
                          className={`pop-in absolute right-3 bottom-3 flex items-center gap-1.5 rounded-xl p-1.5 ${
                            frosted
                              ? 'border border-white/25 bg-zinc-950/25 backdrop-blur-[15px]'
                              : 'bg-zinc-950/80 backdrop-blur'
                          }`}
                        >
                          {!csc.scrollForwarding && (
                            <button
                              type="button"
                              onClick={() => void csc.enableScrollForwarding(screenshareVideoRef.current)}
                              className={`rounded-lg px-2 py-1 text-xs font-medium transition hover:bg-white/10 ${pillText}`}
                              title="Scroll over this preview to scroll the shared tab"
                            >
                              Enable scroll control
                            </button>
                          )}
                          {csc.zoomLevel !== null && (
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={csc.zoomOut}
                                disabled={csc.zoomLevel === csc.zoomLevels[0]}
                                aria-label="Zoom out shared tab"
                                className={`flex size-7 items-center justify-center rounded-lg text-sm font-semibold transition hover:bg-white/10 disabled:opacity-30 ${pillText}`}
                              >
                                −
                              </button>
                              <span className={`w-10 text-center text-xs tabular-nums ${pillText}`}>
                                {csc.zoomLevel}%
                              </span>
                              <button
                                type="button"
                                onClick={csc.zoomIn}
                                disabled={csc.zoomLevel === csc.zoomLevels[csc.zoomLevels.length - 1]}
                                aria-label="Zoom in shared tab"
                                className={`flex size-7 items-center justify-center rounded-lg text-sm font-semibold transition hover:bg-white/10 disabled:opacity-30 ${pillText}`}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-zinc-900 text-sm text-zinc-500">
                      Starting screenshare…
                    </div>
                  )}
                </div>
                <div className="panel-scroll flex shrink-0 gap-3 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto">
                  {participants.map((p) => (
                    <div key={p.id} className="aspect-video w-44 shrink-0 lg:w-full">
                      <VideoTile participant={p} frosted={frosted} />
                    </div>
                  ))}
                </div>
              </div>
            ) : featuredParticipant ? (
              <div className="flex h-full flex-col gap-3 lg:flex-row">
                <div className="min-h-0 flex-1">
                  <VideoTile
                    frosted={frosted}
                    participant={featuredParticipant}
                    style={tileTransitionStyle(featuredParticipant.id)}
                    onDoubleClick={() => toggleFeatured(featuredParticipant.id)}
                  />
                </div>
                <div className="panel-scroll flex shrink-0 gap-3 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto">
                  {participants
                    .filter((p) => p.id !== featuredParticipant.id)
                    .map((p) => (
                      <div key={p.id} className="aspect-video w-44 shrink-0 lg:w-full">
                        <VideoTile
                          frosted={frosted}
                          participant={p}
                          style={tileTransitionStyle(p.id)}
                          onDoubleClick={() => toggleFeatured(p.id)}
                        />
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="video-grid-area flex h-full items-center justify-center">
                <div
                  className="video-grid gap-3"
                  style={
                    {
                      '--grid-cols-landscape': landscapeColumns(participants.length),
                      '--grid-rows-landscape': Math.max(
                        1,
                        Math.ceil(participants.length / landscapeColumns(participants.length)),
                      ),
                      '--grid-cols-portrait': portraitColumns(participants.length),
                      '--grid-rows-portrait': Math.max(
                        1,
                        Math.ceil(participants.length / portraitColumns(participants.length)),
                      ),
                    } as CSSProperties
                  }
                >
                  {participants.map((p) => (
                    <div key={p.id} className="tile-cell">
                      <VideoTile
                        frosted={frosted}
                        participant={p}
                        style={tileTransitionStyle(p.id)}
                        onDoubleClick={() => toggleFeatured(p.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>

          {isMobile && (
            <div
              className={`absolute inset-0 z-10 px-2 pb-1 transition-all duration-300 ease-out ${
                panelOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
              }`}
              aria-hidden={!panelOpen}
              inert={!panelOpen}
            >
              {sidePanel}
            </div>
          )}
        </div>

        <Toolbar
          localMedia={localMedia}
          frosted={frosted}
          isCameraEnabled={state.isCameraEnabled}
          isMicrophoneEnabled={state.isMicrophoneEnabled}
          isScreensharing={isScreensharing}
          isTranscribing={isTranscribing}
          isBoardOpen={boardOpen}
          isBoardActive={boardActivity}
          onToggleBoard={() => setBoardOpen((open) => !open)}
          isMobile={isMobile}
          activePanel={panelOpen ? panelTab : null}
          unreadChatCount={unreadChatCount}
          onToggleCamera={() => actions.toggleCamera()}
          onToggleMicrophone={() => actions.toggleMicrophone()}
          onToggleScreenshare={() => (isScreensharing ? stopSharing() : startSharing())}
          onToggleTranscription={onToggleTranscription}
          onToggleChat={() => togglePanel('chat')}
          onTogglePeople={() => togglePanel('people')}
          onLeave={onLeave}
        />
      </div>

      {/* Desktop: width-animated side column keeps the panel mounted to slide */}
      {!isMobile && (
        <div
          className="overflow-hidden transition-[width] duration-300 ease-out"
          style={{ width: panelOpen ? '24rem' : 0 }}
          aria-hidden={!panelOpen}
          inert={!panelOpen}
        >
          {sidePanel}
        </div>
      )}

      {/* Document PiP popout: DUPLICATE tiles (same MediaStreams, muted so
          audio only plays once) — the main window keeps rendering everything */}
      {pip.pipWindow &&
        createPortal(
          <div
            className="pip-root grid gap-1.5 bg-zinc-950 p-1.5"
            style={{
              gridTemplateColumns: `repeat(${participants.length <= 1 ? 1 : 2}, minmax(0, 1fr))`,
              gridAutoRows: 'minmax(0, 1fr)',
            }}
          >
            {participants.map((p) => (
              <VideoTile key={p.id} participant={p} muteAudio />
            ))}
          </div>,
          pip.pipWindow.document.body,
        )}
    </div>
  )
}
