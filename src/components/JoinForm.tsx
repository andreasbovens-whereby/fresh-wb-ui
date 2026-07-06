import { useRef, useState } from 'react'
import { addRecentUrl, getRecentUrls, removeRecentUrl } from '../lib/recentUrls'
import { CloseIcon, LinkIcon } from './icons'

interface JoinFormProps {
  onJoin: (roomUrl: string) => void
}

function validate(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return 'Paste a Whereby room URL to join.'
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return 'That doesn’t look like a valid URL.'
  }
  if (url.pathname === '/' || url.pathname === '') {
    return 'The URL is missing a room name (e.g. https://subdomain.whereby.com/room-name).'
  }
  return null
}

export default function JoinForm({ onJoin }: JoinFormProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recents, setRecents] = useState<string[]>(getRecentUrls)
  const [showRecents, setShowRecents] = useState(false)
  const blurTimeout = useRef<number>(undefined)

  function submit(url: string) {
    const problem = validate(url)
    if (problem) {
      setError(problem)
      return
    }
    const trimmed = url.trim()
    addRecentUrl(trimmed)
    onJoin(trimmed)
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6">
      <main className="fade-in w-full max-w-xl">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
            <LinkIcon width="1.75em" height="1.75em" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Fresh Whereby UI</h1>
          <p className="mt-2 text-zinc-400">
            Paste a Whereby Embedded room URL — host or visitor link — to join with a fresh look.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(value)
          }}
        >
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
              }}
              onFocus={() => {
                window.clearTimeout(blurTimeout.current)
                setShowRecents(true)
              }}
              onBlur={() => {
                // Delay so clicks inside the dropdown land before it closes
                blurTimeout.current = window.setTimeout(() => setShowRecents(false), 150)
              }}
              placeholder="https://subdomain.whereby.com/room-name?roomKey=…"
              autoFocus
              spellCheck={false}
              className={`w-full rounded-2xl border bg-zinc-900 px-5 py-4 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:ring-2 ${
                error
                  ? 'border-red-500/60 focus:ring-red-500/30'
                  : 'border-zinc-700/80 focus:border-brand-500/60 focus:ring-brand-500/25'
              }`}
            />

            {showRecents && recents.length > 0 && (
              <div className="pop-in absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900 shadow-xl shadow-black/40">
                <p className="px-4 pt-3 pb-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Recent rooms
                </p>
                <ul className="panel-scroll max-h-64 overflow-y-auto pb-2">
                  {recents.map((url) => (
                    <li key={url} className="group flex items-center gap-1 px-2">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setValue(url)
                          setError(null)
                          setShowRecents(false)
                        }}
                        className="min-w-0 flex-1 rounded-xl px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        <span className="block truncate">{url}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${url} from recent rooms`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setRecents(removeRecentUrl(url))}
                        className="rounded-lg p-2 text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:bg-zinc-800 hover:text-zinc-200 focus:opacity-100"
                      >
                        <CloseIcon width="1em" height="1em" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            className="mt-5 w-full rounded-2xl bg-brand-500 py-4 text-sm font-semibold text-brand-950 transition hover:bg-brand-400 focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
          >
            Continue
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Internal testing tool — rooms are created via the Whereby Embedded API.
        </p>
      </main>
    </div>
  )
}
