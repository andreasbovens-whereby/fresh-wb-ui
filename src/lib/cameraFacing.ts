/**
 * Whether the local preview should be mirrored: front cameras (and regular
 * webcams, which report no facingMode) mirror; back cameras don't.
 */
export function shouldMirror(stream?: MediaStream | null): boolean {
  const track = stream?.getVideoTracks()[0]
  if (!track) return true
  const facing = track.getSettings?.().facingMode
  if (facing) return facing !== 'environment'
  return !/back|rear|environment/i.test(track.label)
}
