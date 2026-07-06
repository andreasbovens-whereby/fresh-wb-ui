import { CloseIcon, SpinnerIcon } from './icons'

interface StatusScreenProps {
  title: string
  body?: string
  spinner?: boolean
  tone?: 'neutral' | 'error'
  actionLabel?: string
  onAction?: () => void
}

export default function StatusScreen({
  title,
  body,
  spinner,
  tone = 'neutral',
  actionLabel,
  onAction,
}: StatusScreenProps) {
  return (
    <div className="fade-in flex min-h-full flex-col items-center justify-center px-6 text-center">
      <div
        className={`mb-6 flex size-16 items-center justify-center rounded-2xl ${
          tone === 'error' ? 'bg-red-500/15 text-red-400' : 'bg-brand-500/15 text-brand-400'
        }`}
      >
        {spinner ? (
          <SpinnerIcon width="2em" height="2em" />
        ) : (
          <CloseIcon width="2em" height="2em" />
        )}
      </div>
      <h1 className="max-w-md text-2xl font-semibold tracking-tight">{title}</h1>
      {body && <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-400">{body}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-8 rounded-2xl border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
