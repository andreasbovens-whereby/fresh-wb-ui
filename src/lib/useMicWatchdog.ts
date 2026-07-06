import { useCallback, useEffect, useRef, useState } from 'react'
import type { UseLocalMediaResult } from '@whereby.com/browser-sdk/react'
import { getLiveAudioTrack, requestMicrophoneAccess } from './micAccess'

const POLL_MS = 1000
/** Consecutive bad polls before we flag a problem (route changes cause brief blips) */
const BAD_POLLS_THRESHOLD = 3
/** How long the two doSwitchLocalStream refreshes are spaced apart — rapid
 * back-to-back getUserMedia calls race each other on iOS and can end muted. */
const REFRESH_REVERT_MS = 2500

/**
 * 'muted'   — a track exists but iOS OS-muted it (track.muted, audio session lost)
 * 'missing' — no live audio track at all (initial getUserMedia fell back to
 *             camera-only; the SDK has no path to add audio to a live call)
 */
export type MicProblem = 'muted' | 'missing' | null

interface MicWatchdogResult {
  micProblem: MicProblem
  /** Mic permission is denied at the browser level — needs manual settings change */
  micBlocked: boolean
  fixMicrophone: () => Promise<void>
}

/**
 * Watches the local audio track during a call and recovers when iOS Safari
 * silences it. Two failure modes with different recoveries: an OS-muted track
 * gets an audio-session nudge then a stream refresh; a missing track needs an
 * explicit permission request and — because the SDK can't plumb a brand-new
 * audio track into a live RTC connection — a room rejoin (onAudioRestored).
 */
export function useMicWatchdog(
  localMedia: UseLocalMediaResult,
  micShouldBeLive: boolean,
  onAudioRestored: () => void,
): MicWatchdogResult {
  const [micProblem, setMicProblem] = useState<MicProblem>(null)
  const [micBlocked, setMicBlocked] = useState(false)
  const badPolls = useRef(0)
  const autoFixAttempted = useRef(false)
  const fixInFlight = useRef(false)

  const { toggleLowDataModeEnabled } = localMedia.actions
  const localMediaRef = useRef(localMedia)
  localMediaRef.current = localMedia
  const onAudioRestoredRef = useRef(onAudioRestored)
  onAudioRestoredRef.current = onAudioRestored

  const refreshAudio = useCallback(() => {
    // The only public lever that makes the SDK re-acquire the mic via a fresh
    // getUserMedia and swap the new track into the RTC connection: a low-data
    // mode change triggers doSwitchLocalStream with the current device ids.
    console.warn('[mic-watchdog] re-acquiring microphone via stream refresh')
    toggleLowDataModeEnabled(true)
    setTimeout(() => toggleLowDataModeEnabled(false), REFRESH_REVERT_MS)
  }, [toggleLowDataModeEnabled])

  const nudgeAudioSession = useCallback(async () => {
    // Briefly running a (silent) AudioContext re-activates the page's audio
    // session in record-capable mode; WebKit then unmutes the capture track.
    console.warn('[mic-watchdog] reactivating audio session')
    try {
      const ctx = new AudioContext()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      gain.gain.value = 0 // silent
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start()
      await ctx.resume()
      await new Promise((resolve) => setTimeout(resolve, 500))
      oscillator.stop()
      await ctx.close()
    } catch (error) {
      console.warn('[mic-watchdog] audio session nudge failed:', error)
    }
  }, [])

  const fixMicrophone = useCallback(async () => {
    if (fixInFlight.current) return
    fixInFlight.current = true
    try {
      const stream = localMediaRef.current.state.localStream
      const track = getLiveAudioTrack(stream)

      if (!track) {
        // Missing track: request access (this is what pops the iOS permission
        // prompt — must be called from a user gesture), wait for the SDK to
        // acquire the device, then hand off for a rejoin so the new track
        // actually reaches the room.
        const result = await requestMicrophoneAccess(localMediaRef.current)
        if (result === 'blocked') {
          setMicBlocked(true)
          return
        }
        if (result === 'failed') return
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 500))
          if (getLiveAudioTrack(localMediaRef.current.state.localStream)) {
            console.warn('[mic-watchdog] microphone acquired — rejoining room')
            badPolls.current = 0
            setMicProblem(null)
            onAudioRestoredRef.current()
            return
          }
        }
        console.warn('[mic-watchdog] microphone did not come up after access grant')
        return
      }

      // OS-muted track — stage 1: audio session reactivation (least invasive).
      await nudgeAudioSession()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const after = getLiveAudioTrack(localMediaRef.current.state.localStream)
      if (after && !after.muted) {
        console.warn('[mic-watchdog] microphone recovered via audio session')
        badPolls.current = 0
        setMicProblem(null)
        return
      }
      // Stage 2: full re-acquisition through the SDK.
      refreshAudio()
    } finally {
      fixInFlight.current = false
    }
  }, [nudgeAudioSession, refreshAudio])

  const stream = localMedia.state.localStream
  useEffect(() => {
    if (!micShouldBeLive || !stream) {
      badPolls.current = 0
      setMicProblem(null)
      return
    }

    const timer = setInterval(() => {
      // Re-read every tick: stream refreshes swap tracks inside the same
      // MediaStream instance, so a captured track would go stale.
      const track = stream.getAudioTracks()[0]
      const live = track && track.readyState === 'live'
      const problem: MicProblem = !live ? 'missing' : track.muted ? 'muted' : null

      if (!problem) {
        if (badPolls.current >= BAD_POLLS_THRESHOLD) {
          console.warn('[mic-watchdog] microphone recovered')
        }
        badPolls.current = 0
        autoFixAttempted.current = false
        setMicProblem(null)
        return
      }

      badPolls.current += 1
      if (badPolls.current === BAD_POLLS_THRESHOLD) {
        console.warn('[mic-watchdog] microphone problem detected', {
          problem,
          hasTrack: Boolean(track),
          muted: track?.muted,
          readyState: track?.readyState,
          enabled: track?.enabled,
          label: track?.label,
        })
        setMicProblem(problem)
        // Auto-recover only the muted case — the missing case pops a
        // permission prompt and must come from the user's Fix tap.
        if (problem === 'muted' && !autoFixAttempted.current) {
          autoFixAttempted.current = true
          void fixMicrophone()
        }
      }
    }, POLL_MS)

    return () => clearInterval(timer)
  }, [micShouldBeLive, stream, fixMicrophone])

  return { micProblem, micBlocked, fixMicrophone }
}
