import { useEffect, useRef } from 'react'

/** Camera capture is suspended by the OS for backgrounded mobile browsers */
export function isMobileDevice(): boolean {
  return (
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    // iPadOS masquerades as macOS but has touch points
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

interface CameraAutoPauseOptions {
  /** Only act while connected and on a device that suspends background capture */
  enabled: boolean
  isCameraEnabled: boolean
  toggleCamera: (enabled?: boolean) => void
}

/**
 * Mobile OSes cut camera access when the browser is backgrounded, leaving
 * remote participants with a frozen/black tile. Instead, signal camera-off on
 * app switch (others see the avatar tile) and re-enable on return. The SDK
 * stops the track on disable and runs a fresh getUserMedia on enable, which
 * conveniently sidesteps returning-track muting quirks.
 */
export function useCameraAutoPause({ enabled, isCameraEnabled, toggleCamera }: CameraAutoPauseOptions) {
  const autoPaused = useRef(false)
  const cameraOnRef = useRef(isCameraEnabled)
  cameraOnRef.current = isCameraEnabled
  const toggleRef = useRef(toggleCamera)
  toggleRef.current = toggleCamera

  useEffect(() => {
    if (!enabled) return

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        if (cameraOnRef.current) {
          autoPaused.current = true
          toggleRef.current(false)
        }
      } else if (autoPaused.current) {
        autoPaused.current = false
        // Give iOS a beat to hand the camera back after foregrounding
        setTimeout(() => toggleRef.current(true), 500)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      // Don't leave the camera off if we unmount mid-pause (e.g. leaving the
      // call while backgrounded) — the lobby preview reuses the same media.
      if (autoPaused.current) {
        autoPaused.current = false
        toggleRef.current(true)
      }
    }
  }, [enabled])
}
