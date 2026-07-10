/**
 * `liveCaptions` (the caption-text feed) is a per-client SDK subscription —
 * enabling it on one participant's connection never surfaces on anyone
 * else's, so it can't drive a shared "transcription is on" indicator.
 * Broadcast it ourselves over the room's existing chat channel instead: a
 * marker message filtered out of the visible chat, transcript timeline, and
 * copy export. Prefixed with zero-width spaces (invisible, but ordinary
 * Unicode text) rather than a control character — a NUL byte risks being
 * silently stripped or rejected by chat storage layers.
 */
const SIGNAL_PREFIX = '\u200B\u200Bwb-transcription:'

export function encodeTranscriptionSignal(active: boolean): string {
  return `${SIGNAL_PREFIX}${active ? 'on' : 'off'}`
}

export function isTranscriptionSignal(text: string): boolean {
  return text.startsWith(SIGNAL_PREFIX)
}

export function transcriptionSignalIsActive(text: string): boolean {
  return text === encodeTranscriptionSignal(true)
}
