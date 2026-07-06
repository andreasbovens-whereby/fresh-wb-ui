import type { WaitingParticipant } from '@whereby.com/browser-sdk/react'

interface WaitingParticipantsNoticeProps {
  waitingParticipants: WaitingParticipant[]
  onAccept: (participantId: string) => void
  onReject: (participantId: string) => void
}

/** Floating host-side toast: someone knocked and wants to join. */
export default function WaitingParticipantsNotice({
  waitingParticipants,
  onAccept,
  onReject,
}: WaitingParticipantsNoticeProps) {
  if (waitingParticipants.length === 0) return null

  return (
    <div className="absolute top-5 left-1/2 z-20 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {waitingParticipants.map((p) => (
        <div
          key={p.id}
          className="pop-in flex items-center gap-3 rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-3 pl-4 shadow-xl shadow-black/40 backdrop-blur"
        >
          <p className="min-w-0 flex-1 text-sm text-zinc-200">
            <span className="font-semibold">{p.displayName || 'Someone'}</span> wants to join
          </p>
          <button
            type="button"
            onClick={() => onReject(p.id)}
            className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={() => onAccept(p.id)}
            className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-brand-950 transition hover:bg-brand-400"
          >
            Admit
          </button>
        </div>
      ))}
    </div>
  )
}
