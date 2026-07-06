import type { UseLocalMediaResult } from '@whereby.com/browser-sdk/react'

export function getLiveAudioTrack(stream?: MediaStream | null): MediaStreamTrack | undefined {
  const track = stream?.getAudioTracks()[0]
  return track && track.readyState === 'live' ? track : undefined
}

export type MicAccessResult = 'ok' | 'blocked' | 'failed'

/**
 * The SDK's initial getUserMedia silently falls back to camera-only when the
 * audio request fails (no prompt, no error state, currentMicrophoneDeviceId
 * stays undefined — so its own refresh paths run with audio:false forever).
 * This explicitly requests the microphone (triggering the permission prompt),
 * then routes the granted device through the SDK so it acquires the mic
 * properly itself.
 */
export async function requestMicrophoneAccess(
  localMedia: UseLocalMediaResult,
): Promise<MicAccessResult> {
  let probe: MediaStream
  try {
    probe = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (error) {
    console.warn('[mic-access] getUserMedia(audio) failed:', error)
    const name = error instanceof DOMException ? error.name : ''
    return name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : 'failed'
  }

  const deviceId = probe.getAudioTracks()[0]?.getSettings().deviceId
  // Stop the probe immediately — iOS allows one active capture per device and
  // the SDK is about to (re)acquire it.
  probe.getTracks().forEach((track) => track.stop())
  if (!deviceId) return 'failed'

  if (localMedia.state.currentMicrophoneDeviceId === deviceId) {
    // Same id: the device-change listener won't fire, so force a stream
    // refresh instead (doSwitchLocalStream picks up the now-grantable mic).
    localMedia.actions.toggleLowDataModeEnabled(true)
    setTimeout(() => localMedia.actions.toggleLowDataModeEnabled(false), 2500)
  } else {
    localMedia.actions.setMicrophoneDevice(deviceId)
  }
  return 'ok'
}
