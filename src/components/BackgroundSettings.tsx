import { useEffect, useRef, type RefObject } from 'react'
import {
  BACKGROUND_COLORS,
  BACKGROUND_IMAGES,
  type BackgroundChoice,
} from '../lib/backgrounds'
import { CloseIcon } from './icons'

interface BackgroundSettingsProps {
  choice: BackgroundChoice
  onChange: (choice: BackgroundChoice) => void
  onClose: () => void
  /** The toggle button — its clicks must not count as outside-clicks, or the
   * panel would close on pointerdown and reopen on the button's click. */
  anchorRef: RefObject<HTMLElement | null>
}

/** Popover panel for picking a call background: none, a photo, or a flat color. */
export default function BackgroundSettings({
  choice,
  onChange,
  onClose,
  anchorRef,
}: BackgroundSettingsProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (ref.current && !ref.current.contains(target) && !anchorRef.current?.contains(target)) {
        onClose()
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, anchorRef])

  const isImage = (id: string) => choice?.type === 'image' && choice.id === id
  const isColor = (hex: string) => choice?.type === 'color' && choice.hex === hex
  const selectedImage =
    choice?.type === 'image' ? BACKGROUND_IMAGES.find((i) => i.id === choice.id) : undefined

  return (
    <div
      ref={ref}
      className="pop-in absolute top-14 right-4 z-30 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">Background</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <CloseIcon width="1em" height="1em" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onChange(null)}
        className={`mb-3 w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
          choice === null
            ? 'border-brand-500/60 bg-brand-500/10 text-brand-300'
            : 'border-zinc-700/80 text-zinc-300 hover:bg-zinc-800'
        }`}
      >
        None (default)
      </button>

      <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Photos</p>
      <div className="mb-1.5 grid grid-cols-2 gap-2">
        {BACKGROUND_IMAGES.map((image) => (
          <button
            key={image.id}
            type="button"
            onClick={() => onChange({ type: 'image', id: image.id })}
            className={`group relative overflow-hidden rounded-xl border-2 transition ${
              isImage(image.id) ? 'border-brand-400' : 'border-transparent hover:border-zinc-600'
            }`}
          >
            <img
              src={image.url}
              alt={image.label}
              loading="lazy"
              className="h-16 w-full object-cover"
            />
            <span className="absolute bottom-1 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {image.label}
            </span>
          </button>
        ))}
      </div>

      <p className="mb-3 text-[11px] text-zinc-500">
        {selectedImage ? (
          <>
            Photo by{' '}
            <a
              href={selectedImage.creditUrl}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-zinc-300"
            >
              {selectedImage.credit}
            </a>{' '}
            on{' '}
            <a
              href="https://unsplash.com"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-zinc-300"
            >
              Unsplash
            </a>
          </>
        ) : (
          <>
            Photos from{' '}
            <a
              href="https://unsplash.com"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-zinc-300"
            >
              Unsplash
            </a>
          </>
        )}
      </p>

      <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Colors</p>
      <div className="grid grid-cols-10 gap-1.5">
        {BACKGROUND_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onChange({ type: 'color', hex })}
            aria-label={`Background color ${hex}`}
            style={{ backgroundColor: hex }}
            className={`aspect-square rounded-md border-2 transition hover:scale-110 ${
              isColor(hex) ? 'border-white' : 'border-transparent'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
