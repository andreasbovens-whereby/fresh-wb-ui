import { useCallback, useRef, useState } from 'react'

// Captured Surface Control (https://w3c.github.io/mediacapture-surface-control/)
// isn't in TS's DOM lib yet. Chrome 136+ desktop only.
interface CaptureController extends EventTarget {
  setFocusBehavior?(behavior: 'focus-capturing-application' | 'focus-captured-surface' | 'no-focus-change'): void
  forwardWheel(element: HTMLElement | null): Promise<void>
  getSupportedZoomLevels(): number[]
  readonly zoomLevel: number
  increaseZoomLevel(): Promise<void>
  decreaseZoomLevel(): Promise<void>
  resetZoomLevel(): Promise<void>
}
interface CaptureControllerConstructor {
  new (): CaptureController
}
declare global {
  interface Window {
    CaptureController?: CaptureControllerConstructor
  }
  interface DisplayMediaStreamOptions {
    controller?: CaptureController
  }
}

/**
 * Bridges the Whereby SDK's screenshare action — which calls getDisplayMedia
 * internally with no way to pass options in — to the Captured Surface
 * Control API, which requires a CaptureController to be present in that same
 * call. There's no supported extension point for this, so prepareNextShare()
 * monkey-patches navigator.mediaDevices.getDisplayMedia for exactly one
 * call (self-restoring) to inject the controller, right before triggering
 * actions.startScreenshare().
 *
 * Only tab captures (displaySurface: "browser") support zoom/scroll control;
 * window and full-screen captures silently have no controls, detected once
 * the resulting stream is known.
 *
 * No displaySurface constraint hint is added to the getDisplayMedia call —
 * it isn't required for the feature to work, only biases the OS picker.
 * Scroll forwarding stays opt-in (a real user click, guaranteeing the
 * transient activation forwardWheel requires); zoom querying happens
 * automatically once a tab capture is confirmed, same as before.
 */
export function useCapturedSurfaceControl() {
  const supported = typeof window !== 'undefined' && 'CaptureController' in window
  const controllerRef = useRef<CaptureController | null>(null)
  const [isTabCapture, setIsTabCapture] = useState(false)
  const [zoomLevel, setZoomLevel] = useState<number | null>(null)
  const [zoomLevels, setZoomLevels] = useState<number[]>([])
  const [scrollForwarding, setScrollForwarding] = useState(false)

  const prepareNextShare = useCallback(() => {
    if (!supported) return
    const controller = new window.CaptureController!()
    try {
      controller.setFocusBehavior?.('focus-capturing-application')
    } catch {
      // best effort — keep sharing even if focus-pinning isn't supported
    }
    controllerRef.current = controller

    const mediaDevices = navigator.mediaDevices
    const original = mediaDevices.getDisplayMedia.bind(mediaDevices)
    mediaDevices.getDisplayMedia = (options: DisplayMediaStreamOptions = {}) => {
      mediaDevices.getDisplayMedia = original // one-shot
      return original({ ...options, controller })
    }
  }, [supported])

  /** Call once the local screenshare's real stream is known. */
  const onShareStarted = useCallback((stream: MediaStream) => {
    const controller = controllerRef.current
    if (!controller) return
    const tabCapture = stream.getVideoTracks()[0]?.getSettings().displaySurface === 'browser'
    setIsTabCapture(tabCapture)
    if (!tabCapture) return
    try {
      setZoomLevels(controller.getSupportedZoomLevels())
      setZoomLevel(controller.zoomLevel)
    } catch {
      // zoom unsupported for this surface — controls stay hidden
    }
    controller.addEventListener('zoomlevelchange', () => setZoomLevel(controller.zoomLevel))
  }, [])

  const reset = useCallback(() => {
    controllerRef.current = null
    setIsTabCapture(false)
    setZoomLevel(null)
    setZoomLevels([])
    setScrollForwarding(false)
  }, [])

  /** Explicit user click, not auto-armed — guarantees the transient
   * activation forwardWheel requires, rather than relying on activation
   * surviving the async gap after the getDisplayMedia picker closes. */
  const enableScrollForwarding = useCallback(async (previewElement: HTMLElement | null) => {
    try {
      await controllerRef.current?.forwardWheel(previewElement)
      setScrollForwarding(true)
    } catch (error) {
      console.warn('[captured-surface-control] forwardWheel failed:', error)
    }
  }, [])

  const zoomIn = useCallback(() => controllerRef.current?.increaseZoomLevel().catch(() => {}), [])
  const zoomOut = useCallback(() => controllerRef.current?.decreaseZoomLevel().catch(() => {}), [])
  const zoomReset = useCallback(() => controllerRef.current?.resetZoomLevel().catch(() => {}), [])

  return {
    supported,
    isTabCapture,
    zoomLevel,
    zoomLevels,
    scrollForwarding,
    prepareNextShare,
    onShareStarted,
    enableScrollForwarding,
    zoomIn,
    zoomOut,
    zoomReset,
    reset,
  }
}
