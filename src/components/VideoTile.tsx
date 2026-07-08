import type { CSSProperties } from 'react'
import { VideoView } from '@whereby.com/browser-sdk/react'
import { shouldMirror } from '../lib/cameraFacing'
import { MicOffIcon } from './icons'

export interface TileParticipant {
  id: string
  displayName: string
  stream?: MediaStream | null
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  isLocal: boolean
}

interface VideoTileProps {
  participant: TileParticipant
  onDoubleClick?: () => void
  style?: CSSProperties
  /** Custom background active — float the tile with a border and under-shadow */
  frosted?: boolean
  /** For duplicated tiles (PiP window): audio already plays in the main window */
  muteAudio?: boolean
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?'
  )
}

export default function VideoTile({
  participant,
  onDoubleClick,
  style,
  frosted,
  muteAudio = false,
}: VideoTileProps) {
  const { displayName, stream, isAudioEnabled, isVideoEnabled, isLocal } = participant
  const label = isLocal ? `${displayName} (you)` : displayName

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-2xl bg-zinc-900 ${
        frosted ? 'border border-white/25 shadow-[0_10px_30px_rgba(0,0,0,0.35)]' : ''
      }`}
      style={style}
      onDoubleClick={onDoubleClick}
      title={onDoubleClick ? 'Double-click to toggle focus' : undefined}
    >
      {stream && isVideoEnabled ? (
        <VideoView
          stream={stream}
          muted={isLocal || muteAudio}
          mirror={isLocal && shouldMirror(stream)}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          {/* Keep audio flowing when the remote camera is off */}
          {stream && !isLocal && !muteAudio && (
            <VideoView stream={stream} className="hidden" />
          )}
          <div className="flex size-16 items-center justify-center rounded-full bg-zinc-800 text-xl font-semibold text-zinc-400 sm:size-20">
            {initials(displayName)}
          </div>
        </div>
      )}

      <div
        className={`absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-lg py-1 pr-2.5 pl-1.5 ${
          frosted ? 'border border-white/25 bg-zinc-950/25 backdrop-blur-[15px]' : 'bg-black/55 backdrop-blur-sm'
        }`}
      >
        {!isAudioEnabled && (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-red-500 text-white">
            <MicOffIcon width="0.8em" height="0.8em" />
          </span>
        )}
        <span
          className={`truncate text-xs font-medium text-white ${
            frosted ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]' : ''
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  )
}
