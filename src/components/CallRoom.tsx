import { lazy, Suspense, useMemo, useState, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
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
import { PeopleIcon, SpinnerIcon } from './icons'
import { useMediaQuery } from '../lib/useMediaQuery'
import { useBoardActivity } from '../lib/useBoardActivity'
import type { MicProblem } from '../lib/useMicWatchdog'

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
  // Tolerates the featured participant leaving mid-call
  const featuredParticipant = participants.find((p) => p.id === featuredId)
  const isScreensharing =
    state.localScreenshareStatus === 'starting' || state.localScreenshareStatus === 'active'
  const chatVisible = panelOpen && panelTab === 'chat'
  const unreadChatCount = state.chatMessages.length - seenChatCount

  function updatePanel(open: boolean, tab: PanelTab = panelTab) {
    // Entering or leaving the chat tab counts everything so far as read
    if ((open && tab === 'chat') || chatVisible) setSeenChatCount(state.chatMessages.length)
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
      chatMessages={state.chatMessages}
      transcript={transcript}
      isTranscribing={isTranscribing}
      participants={participants}
      localParticipantId={state.localParticipant?.id}
      onSendMessage={actions.sendChatMessage}
    />
  )

  return (
    <div className="fade-in flex h-full">
      <div className="relative flex min-w-0 flex-1 flex-col">
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
          <span className="text-lg font-semibold tracking-tight">
            Fresh <span className="text-brand-400">·</span> Whereby
          </span>
          <span className="flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300">
            <PeopleIcon />
            {participants.length}
          </span>
        </header>

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
                      <VideoTile participant={p} />
                    </div>
                  ))}
                </div>
              </div>
            ) : featuredScreenshare ? (
              <div className="fade-in flex h-full flex-col gap-3 lg:flex-row">
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-zinc-900">
                  {featuredScreenshare.stream ? (
                    <VideoView
                      stream={featuredScreenshare.stream}
                      muted={featuredScreenshare.isLocal}
                      style={{ objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                      Starting screenshare…
                    </div>
                  )}
                  {featuredScreenshare.isLocal && (
                    <div className="pop-in absolute top-3 left-3 flex items-center gap-2 rounded-xl bg-zinc-950/80 p-1.5 pl-3 backdrop-blur">
                      <span className="text-xs font-medium text-zinc-200">You are presenting</span>
                      <button
                        type="button"
                        onClick={() => actions.stopScreenshare()}
                        className="rounded-lg bg-red-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-400 active:scale-95"
                      >
                        Stop sharing
                      </button>
                    </div>
                  )}
                </div>
                <div className="panel-scroll flex shrink-0 gap-3 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto">
                  {participants.map((p) => (
                    <div key={p.id} className="aspect-video w-44 shrink-0 lg:w-full">
                      <VideoTile participant={p} />
                    </div>
                  ))}
                </div>
              </div>
            ) : featuredParticipant ? (
              <div className="flex h-full flex-col gap-3 lg:flex-row">
                <div className="min-h-0 flex-1">
                  <VideoTile
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
          onToggleScreenshare={() =>
            isScreensharing ? actions.stopScreenshare() : actions.startScreenshare()
          }
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
    </div>
  )
}
