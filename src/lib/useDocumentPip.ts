import { useCallback, useEffect, useRef, useState } from 'react'

// Document Picture-in-Picture isn't in TS's lib.dom yet (Chrome/Edge only)
interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>
  window: Window | null
}
declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture
  }
}

/** Copy every stylesheet into the PiP document so portal content (Tailwind
 * classes, our custom CSS incl. the display-mode media query) renders styled. */
function copyStyleSheets(target: Window) {
  for (const sheet of document.styleSheets) {
    try {
      const rules = [...sheet.cssRules].map((rule) => rule.cssText).join('\n')
      const style = target.document.createElement('style')
      style.textContent = rules
      target.document.head.appendChild(style)
    } catch {
      // Cross-origin sheet — fall back to re-linking it
      if (sheet.href) {
        const link = target.document.createElement('link')
        link.rel = 'stylesheet'
        link.href = sheet.href
        target.document.head.appendChild(link)
      }
    }
  }
}

/**
 * Document Picture-in-Picture window (Chrome/Edge). The returned pipWindow is
 * a live Window whose body can be a React portal target — content there
 * DUPLICATES the main window's (same MediaStreams in fresh <video> elements)
 * rather than moving it, so the main UI never pauses.
 *
 * Also registers Chrome's video-conferencing auto-PiP hook: with the
 * 'enterpictureinpicture' media-session action registered, Chrome invokes it
 * on tab switch during a call — the invocation carries user activation, so
 * requestWindow succeeds there without a click.
 */
export function useDocumentPip() {
  const supported = typeof window !== 'undefined' && 'documentPictureInPicture' in window
  const [pipWindow, setPipWindow] = useState<Window | null>(null)
  const pipWindowRef = useRef<Window | null>(null)
  pipWindowRef.current = pipWindow

  const open = useCallback(async () => {
    if (!supported || pipWindowRef.current) return
    try {
      const win = await window.documentPictureInPicture!.requestWindow({
        width: 480,
        height: 360,
      })
      copyStyleSheets(win)
      win.addEventListener('pagehide', () => setPipWindow(null))
      setPipWindow(win)
    } catch (error) {
      // Most commonly NotAllowedError when called outside user activation
      console.warn('[doc-pip] could not open window:', error)
    }
  }, [supported])

  const close = useCallback(() => {
    pipWindowRef.current?.close()
    setPipWindow(null)
  }, [])

  // Chrome auto-PiP for video conferencing (tab switch during an active call)
  useEffect(() => {
    if (!supported || !('mediaSession' in navigator)) return
    try {
      navigator.mediaSession.setActionHandler('enterpictureinpicture' as MediaSessionAction, () =>
        void open(),
      )
    } catch {
      // action not recognized — fine
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler(
          'enterpictureinpicture' as MediaSessionAction,
          null,
        )
      } catch {
        // ignore
      }
    }
  }, [supported, open])

  // Leaving the call closes the popout
  useEffect(() => close, [close])

  return { supported, pipWindow, open, close }
}
