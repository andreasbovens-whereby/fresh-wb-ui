import { useEffect, useMemo, useRef, useState } from 'react'
import type { RoomConnection } from '@whereby.com/browser-sdk/react'
import type { TileParticipant } from './VideoTile'
import {
  CameraIcon,
  CameraOffIcon,
  CheckIcon,
  CloseIcon,
  CopyIcon,
  MicIcon,
  MicOffIcon,
  SendIcon,
} from './icons'

export type PanelTab = 'chat' | 'people'

// The react entry's ChatMessage alias is narrower than what state.chatMessages
// actually holds (it lacks `id`), so derive the element type from the state.
type ChatMessage = RoomConnection['chatMessages'][number]

/**
 * App-side accumulated caption. The SDK's captionLog drops entries after ~5s
 * (it feeds on-screen subtitles), so CallRoom collects them into a persistent
 * transcript with the speaker name resolved at capture time.
 */
export interface TranscriptEntry {
  id: string
  senderId: string
  senderName: string | null
  time: number
  text: string
}

interface SidePanelProps {
  /** 'side': desktop column. 'overlay': mobile card floating over the tiles. */
  variant: 'side' | 'overlay'
  tab: PanelTab
  onTabChange: (tab: PanelTab) => void
  onClose: () => void
  chatMessages: ChatMessage[]
  transcript: TranscriptEntry[]
  isTranscribing: boolean
  participants: TileParticipant[]
  localParticipantId?: string
  onSendMessage: (text: string) => void
}

interface TimelineItem {
  kind: 'chat' | 'caption'
  id: string
  senderId: string
  senderName: string | null
  time: number
  text: string
}

function formatTime(time: number): string {
  const date = new Date(time)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function ChatTab({
  chatMessages,
  transcript,
  isTranscribing,
  participants,
  localParticipantId,
  onSendMessage,
}: Omit<SidePanelProps, 'variant' | 'tab' | 'onTabChange' | 'onClose'>) {
  const [draft, setDraft] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [copied, setCopied] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const timeline: TimelineItem[] = useMemo(() => {
    const chat: TimelineItem[] = chatMessages.map((m) => ({
      kind: 'chat',
      id: `chat-${m.id}`,
      senderId: m.senderId,
      senderName: null,
      time: new Date(m.timestamp).getTime(),
      text: m.text,
    }))
    if (!showTranscript) return chat
    const spoken: TimelineItem[] = transcript.map((entry) => ({
      kind: 'caption',
      id: `caption-${entry.id}`,
      senderId: entry.senderId,
      senderName: entry.senderName,
      time: entry.time,
      text: entry.text,
    }))
    return [...chat, ...spoken].sort((a, b) => a.time - b.time)
  }, [chatMessages, transcript, showTranscript])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [timeline.length])

  function resolveName(senderId: string): string | null {
    return participants.find((p) => p.id === senderId)?.displayName ?? null
  }

  // Chat labels the local user "You"; transcript entries always carry the
  // speaker's actual display name so the transcript reads like one.
  function itemLabel(item: TimelineItem): string {
    if (item.kind === 'caption') {
      return item.senderName ?? resolveName(item.senderId) ?? 'Speaker'
    }
    if (item.senderId === localParticipantId) return 'You'
    return resolveName(item.senderId) ?? 'Former participant'
  }

  function send() {
    const text = draft.trim()
    if (!text) return
    onSendMessage(text)
    setDraft('')
  }

  async function copyTimeline() {
    const lines = timeline.map(
      (item) =>
        `[${formatTime(item.time)}] ${itemLabel(item)}${
          item.kind === 'caption' ? ' (spoken)' : ''
        }: ${item.text}`,
    )
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={showTranscript}
            onChange={(e) => setShowTranscript(e.target.checked)}
            className="peer sr-only"
          />
          <span className="relative h-5 w-9 rounded-full bg-zinc-700 transition peer-checked:bg-violet-500 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
          Show transcript
          {isTranscribing && (
            <span className="size-2 animate-pulse rounded-full bg-violet-400" title="Transcribing" />
          )}
        </label>
        <button
          type="button"
          onClick={copyTimeline}
          disabled={timeline.length === 0}
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200 disabled:opacity-40"
        >
          {copied ? <CheckIcon className="text-brand-400" /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div ref={listRef} className="panel-scroll flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {timeline.length === 0 ? (
          <p className="mt-10 text-center text-sm leading-relaxed text-zinc-500">
            {showTranscript && !isTranscribing
              ? 'No transcript yet — start transcription from the toolbar.'
              : 'Chat messages are cleared when the room is empty'}
          </p>
        ) : (
          timeline.map((item) => {
            const own = item.senderId === localParticipantId
            const bubble =
              item.kind === 'caption'
                ? 'bg-violet-500/15 text-violet-100 border border-violet-500/25'
                : own
                  ? 'bg-brand-500 text-brand-950'
                  : 'bg-zinc-800 text-zinc-100'
            return (
              <div key={item.id} className={`pop-in ${own ? 'text-right' : ''}`}>
                <p className="mb-1 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-400">{itemLabel(item)}</span>{' '}
                  {item.kind === 'caption' && <span className="text-violet-400/80">spoke · </span>}
                  {formatTime(item.time)}
                </p>
                <div
                  className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed break-words ${bubble}`}
                >
                  {item.text}
                </div>
              </div>
            )
          })
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="flex items-center gap-2 border-t border-zinc-800 p-4"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Send a chat message…"
          className="min-w-0 flex-1 rounded-2xl border border-zinc-700/80 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-brand-500/60"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Send message"
          className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-brand-950 transition hover:bg-brand-400 disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </form>
    </>
  )
}

function PeopleTab({ participants }: { participants: TileParticipant[] }) {
  return (
    <ul className="panel-scroll flex-1 space-y-1 overflow-y-auto px-3 py-3">
      {participants.map((p) => (
        <li key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-zinc-900">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-400">
            {(p.displayName[0] ?? '?').toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
            {p.displayName}
            {p.isLocal && <span className="text-zinc-500"> (you)</span>}
          </span>
          <span className={p.isAudioEnabled ? 'text-zinc-500' : 'text-red-400'}>
            {p.isAudioEnabled ? <MicIcon /> : <MicOffIcon />}
          </span>
          <span className={p.isVideoEnabled ? 'text-zinc-500' : 'text-red-400'}>
            {p.isVideoEnabled ? <CameraIcon /> : <CameraOffIcon />}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function SidePanel({
  variant,
  tab,
  onTabChange,
  onClose,
  chatMessages,
  transcript,
  isTranscribing,
  participants,
  localParticipantId,
  onSendMessage,
}: SidePanelProps) {
  return (
    <aside
      className={`flex h-full flex-col bg-zinc-950 ${
        variant === 'overlay'
          ? 'w-full rounded-2xl border border-zinc-800 shadow-2xl shadow-black/50'
          : 'w-96 border-l border-zinc-800'
      }`}
    >
      <div className="flex items-center gap-2 border-b border-zinc-800 p-3">
        <div className="flex flex-1 rounded-2xl bg-zinc-900 p-1">
          {(['chat', 'people'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTabChange(t)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium capitalize transition ${
                tab === t ? 'bg-zinc-700/80 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-xl p-2.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
        >
          <CloseIcon />
        </button>
      </div>

      {tab === 'chat' ? (
        <ChatTab
          chatMessages={chatMessages}
          transcript={transcript}
          isTranscribing={isTranscribing}
          participants={participants}
          localParticipantId={localParticipantId}
          onSendMessage={onSendMessage}
        />
      ) : (
        <PeopleTab participants={participants} />
      )}
    </aside>
  )
}
