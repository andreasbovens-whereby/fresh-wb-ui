/**
 * Plays a short two-note chime on the given output device. Routes WebAudio
 * through an <audio> element because only HTMLMediaElement supports setSinkId
 * across browsers.
 */
export async function playTestSound(speakerDeviceId?: string): Promise<void> {
  const ctx = new AudioContext()
  const destination = ctx.createMediaStreamDestination()

  const gain = ctx.createGain()
  gain.connect(destination)

  const now = ctx.currentTime
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.4, now + 0.02)
  gain.gain.setValueAtTime(0.4, now + 0.55)
  gain.gain.linearRampToValueAtTime(0, now + 0.8)

  for (const [freq, start] of [
    [523.25, 0], // C5
    [783.99, 0.18], // G5
  ] as const) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.connect(gain)
    osc.start(now + start)
    osc.stop(now + 0.85)
  }

  const audio = new Audio()
  audio.srcObject = destination.stream
  if (speakerDeviceId && 'setSinkId' in audio) {
    try {
      await audio.setSinkId(speakerDeviceId)
    } catch {
      // fall back to the default output device
    }
  }
  await audio.play()

  await new Promise((resolve) => setTimeout(resolve, 900))
  audio.pause()
  audio.srcObject = null
  await ctx.close()
}
