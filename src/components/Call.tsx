import { useEffect, useMemo, useRef, useState } from 'react'
import { useRoomConnection, type UseLocalMediaResult } from '@whereby.com/browser-sdk/react'
import CallRoom from './CallRoom'
import StatusScreen from './StatusScreen'
import type { TranscriptEntry } from './SidePanel'
import { SpinnerIcon } from './icons'
import { useMicWatchdog } from '../lib/useMicWatchdog'
import { isMobileDevice, useCameraAutoPause } from '../lib/useCameraAutoPause'
import { useMediaSession } from '../lib/useMediaSession'
import { encodeTranscriptionSignal, isTranscriptionSignal, transcriptionSignalIsActive } from '../lib/transcriptionSignal'

interface CallProps {
  roomUrl: string
  localMedia: UseLocalMediaResult
  displayName: string
  /** Remounts this component with a fresh room connection (same lobby media) */
  onRejoin: () => void
  onLeave: () => void
}

/** How long a dropped connection may try to recover before we give up. */
const DISCONNECT_GRACE_MS = 15_000

export default function Call({ roomUrl, localMedia, displayName, onRejoin, onLeave }: CallProps) {
  const { state, actions } = useRoomConnection(roomUrl, { localMedia, displayName })
  const { connectionStatus } = state
  const joined = useRef(false)
  const knocked = useRef(false)
  const hasConnected = useRef(false)
  if (connectionStatus === 'connected') hasConnected.current = true

  const { joinRoom, leaveRoom, knock } = actions

  useEffect(() => {
    if (joined.current) return
    joined.current = true
    joinRoom()
    return () => leaveRoom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Visitor links land in room_locked instead of joining — knock once and wait
  // for the host to let us in; the SDK then flips status to connected.
  useEffect(() => {
    if (connectionStatus === 'room_locked' && !knocked.current) {
      knocked.current = true
      knock()
    }
  }, [connectionStatus, knock])

  // SDK quirk: localParticipant.isAudioEnabled/isVideoEnabled default to true
  // and are never synced from the join payload, while the actual tracks follow
  // the lobby's mute choices. Joining muted therefore leaves the mute
  // signaling permanently inverted for other participants (they see "on" when
  // the mic is off and vice versa). On every (re)connect, if the signaled
  // state disagrees with the real track state, one explicit toggle re-signals
  // the truth and realigns the SDK's internal state.
  useEffect(() => {
    if (connectionStatus !== 'connected') return
    const participant = state.localParticipant
    if (!participant) return
    if (participant.isAudioEnabled !== state.isMicrophoneEnabled) {
      actions.toggleMicrophone(state.isMicrophoneEnabled)
    }
    if (participant.isVideoEnabled !== state.isCameraEnabled) {
      actions.toggleCamera(state.isCameraEnabled)
    }
    // Only on the transition to connected — watching the compared fields too
    // would race the async signal round-trip during normal toggling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus])

  // The SDK's caption status only leaves 'captioning' when the signal server
  // confirms with a live_captions_stopped event — which it doesn't always
  // send (e.g. while other clients keep captions enabled). Without help the
  // stop button then looks dead. So: flip the UI optimistically on click,
  // retry the stop emit a few times, and drop the override once the SDK
  // state agrees.
  const captionsStatus = state.liveCaptions?.status
  const sdkCaptionsActive = captionsStatus === 'captioning' || captionsStatus === 'requested'
  const [captionsOverride, setCaptionsOverride] = useState<boolean | null>(null)

  // SDK quirk: `liveCaptions` (the caption text feed) is a per-client
  // subscription — starting it on one client never surfaces on anyone
  // else's captionLog or status, even once real speech is captioned. So the
  // toolbar can't rely on it for a shared indicator. Broadcast our own
  // "transcription is on" flag over the room's chat channel instead — a
  // marker message filtered out of the visible chat (see transcriptionSignal.ts).
  const { chatMessages } = state
  const { sendChatMessage } = actions
  const transcriptionSignalActive = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (isTranscriptionSignal(chatMessages[i].text)) return transcriptionSignalIsActive(chatMessages[i].text)
    }
    return false
  }, [chatMessages])

  // Combines both signals so the optimistic override below only lets go once
  // BOTH the SDK's own captions status AND our own chat marker (which, like
  // any chat message, only becomes visible to us after a server round trip —
  // there's no local echo) agree with the toggled state. Releasing on
  // sdkCaptionsActive alone let the override drop before our own marker
  // landed, so isTranscribing fell back to the *previous* (stale) marker and
  // flipped back — looking like the toggle didn't take.
  const combinedActive = sdkCaptionsActive || transcriptionSignalActive
  const isTranscribing = captionsOverride ?? combinedActive

  useEffect(() => {
    if (captionsOverride !== null && captionsOverride === combinedActive) {
      setCaptionsOverride(null)
    }
  }, [captionsOverride, combinedActive])

  const { stopLiveCaptions, startLiveCaptions } = actions
  useEffect(() => {
    if (captionsOverride !== false || !combinedActive) return
    let attempts = 0
    const timer = setInterval(() => {
      attempts += 1
      stopLiveCaptions()
      if (attempts >= 3) clearInterval(timer)
    }, 2000)
    return () => clearInterval(timer)
  }, [captionsOverride, combinedActive, stopLiveCaptions])

  function toggleTranscription() {
    if (isTranscribing) {
      stopLiveCaptions()
      sendChatMessage(encodeTranscriptionSignal(false))
      setCaptionsOverride(false)
    } else {
      startLiveCaptions()
      sendChatMessage(encodeTranscriptionSignal(true))
      setCaptionsOverride(true)
    }
  }

  // Chat history from before a client connects never replays (unlike e.g.
  // liveTranscription's roomJoined sync), so a marker sent before someone
  // joins never reaches them — their icon would stay grey forever. Whoever's
  // already in the call re-sends the "on" marker the moment they notice a
  // new participant, so late joiners get a fresh live one.
  const remoteParticipantIds = useMemo(
    () => new Set(state.remoteParticipants.map((p) => p.id)),
    [state.remoteParticipants],
  )
  const knownParticipantIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    const previouslyKnown = knownParticipantIds.current
    const hasNewJoin = [...remoteParticipantIds].some((id) => !previouslyKnown.has(id))
    knownParticipantIds.current = remoteParticipantIds
    if (hasNewJoin && isTranscribing) {
      sendChatMessage(encodeTranscriptionSignal(true))
    }
  }, [remoteParticipantIds, isTranscribing, sendChatMessage])

  // Transcript lives here — NOT in CallRoom — so it survives the brief
  // unmount-worthy statuses of a connection blip. The SDK prunes captionLog
  // entries ~5s after they finalize (it drives on-screen subtitles) and wipes
  // the log when captioning stops or the socket drops, so accumulate every
  // entry. Interim results share a resultId — upsert so text refines in
  // place. Names are resolved at capture time (matching both client id and
  // deviceId) so they survive participants leaving.
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const captionLog = state.liveCaptions?.captionLog
  const { localParticipant, remoteParticipants } = state
  useEffect(() => {
    // isTranscribing gate: after an unconfirmed stop the server may keep
    // streaming captions — the user asked for them to end, so don't append.
    if (!captionLog?.length || !isTranscribing) return
    function resolveName(senderId: string): string | null {
      if (localParticipant && senderId === localParticipant.id) {
        return localParticipant.displayName || 'You'
      }
      const remote = remoteParticipants.find((p) => p.id === senderId || p.deviceId === senderId)
      return remote ? remote.displayName || 'Guest' : null
    }
    setTranscript((prev) => {
      let changed = false
      const next = [...prev]
      const indexById = new Map(next.map((entry, i) => [entry.id, i]))
      for (const caption of captionLog) {
        const i = indexById.get(caption.resultId)
        if (i === undefined) {
          indexById.set(caption.resultId, next.length)
          next.push({
            id: caption.resultId,
            senderId: caption.participantId,
            senderName: resolveName(caption.participantId),
            time: caption.timestamp,
            text: caption.text,
          })
          changed = true
        } else if (next[i].text !== caption.text || next[i].senderName === null) {
          next[i] = {
            ...next[i],
            text: caption.text,
            senderName: next[i].senderName ?? resolveName(caption.participantId),
          }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [captionLog, localParticipant, remoteParticipants, isTranscribing])

  // Detect the iOS "mic silently OS-muted" and "mic track never acquired"
  // conditions; the latter needs a rejoin after access is granted.
  const { micProblem, micBlocked, fixMicrophone } = useMicWatchdog(
    localMedia,
    connectionStatus === 'connected' && state.isMicrophoneEnabled,
    onRejoin,
  )

  // Mobile OSes suspend camera capture when the browser is backgrounded —
  // signal camera-off (avatar tile) instead of leaving a dark frozen frame,
  // and restore on return.
  useCameraAutoPause({
    enabled: connectionStatus === 'connected' && isMobileDevice(),
    isCameraEnabled: state.isCameraEnabled,
    toggleCamera: actions.toggleCamera,
  })

  // Lock-screen / system-UI call controls where supported.
  useMediaSession({
    active: connectionStatus === 'connected',
    roomUrl,
    isMicrophoneEnabled: state.isMicrophoneEnabled,
    isCameraEnabled: state.isCameraEnabled,
    onToggleMicrophone: () => actions.toggleMicrophone(),
    onToggleCamera: () => actions.toggleCamera(),
    onHangup: onLeave,
  })

  // A dropped connection gets a grace period to recover behind a banner
  // before we declare it lost and swap to the error screen.
  const [connectionLost, setConnectionLost] = useState(false)
  useEffect(() => {
    if (connectionStatus !== 'disconnected') {
      setConnectionLost(false)
      return
    }
    const timer = setTimeout(() => setConnectionLost(true), DISCONNECT_GRACE_MS)
    return () => clearTimeout(timer)
  }, [connectionStatus])

  switch (connectionStatus) {
    case 'room_locked':
    case 'knocking':
      return (
        <StatusScreen
          title="Waiting for the host to let you in"
          body="The host has been notified that you want to join. Hang tight — you’ll enter automatically once they accept."
          spinner
          actionLabel="Stop waiting"
          onAction={() => {
            actions.cancelKnock()
            onLeave()
          }}
        />
      )

    case 'knock_rejected':
      return (
        <StatusScreen
          title="The host declined your request"
          body="You weren’t let into this meeting. You can go back and try another room, or ask the host to let you in."
          tone="error"
          actionLabel="Back to start"
          onAction={onLeave}
        />
      )

    case 'kicked':
      return (
        <StatusScreen
          title="You were removed from the meeting"
          body="A host removed you from this room."
          tone="error"
          actionLabel="Back to start"
          onAction={onLeave}
        />
      )

    case 'leaving':
    case 'left':
      return <StatusScreen title="Leaving the meeting…" spinner />

    default: {
      // 'connected' | 'reconnecting' | 'connecting' | 'ready' | 'disconnected'.
      // Once we've been in the room, keep it on screen through transient
      // blips — a full-screen swap loses all visual context for a one-second
      // hiccup. Only give up when the grace period expires.
      if (connectionLost) {
        return (
          <StatusScreen
            title="Connection lost"
            body="The connection to the room was lost and could not be re-established."
            tone="error"
            actionLabel="Back to start"
            onAction={onLeave}
          />
        )
      }
      if (connectionStatus === 'connected' || hasConnected.current) {
        return (
          <CallRoom
            roomUrl={roomUrl}
            state={state}
            actions={actions}
            localMedia={localMedia}
            transcript={transcript}
            isTranscribing={isTranscribing}
            onToggleTranscription={toggleTranscription}
            reconnecting={connectionStatus !== 'connected'}
            micProblem={micProblem}
            micBlocked={micBlocked}
            onFixMicrophone={fixMicrophone}
            onLeave={onLeave}
          />
        )
      }
      if (state.connectionError) {
        return (
          <StatusScreen
            title="Couldn’t connect to the room"
            body={String(state.connectionError)}
            tone="error"
            actionLabel="Back to start"
            onAction={onLeave}
          />
        )
      }
      return (
        <div className="flex min-h-full flex-col items-center justify-center gap-4 text-zinc-400">
          <SpinnerIcon width="2.5em" height="2.5em" className="text-brand-400" />
          <p className="text-sm">Connecting to the room…</p>
        </div>
      )
    }
  }
}
