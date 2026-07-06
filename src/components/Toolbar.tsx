import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { UseLocalMediaResult } from '@whereby.com/browser-sdk/react'
import DeviceMenu, { type DeviceMenuSection } from './DeviceMenu'
import {
  BoardIcon,
  CameraIcon,
  CameraOffIcon,
  ChatIcon,
  ChevronDownIcon,
  LeaveIcon,
  MicIcon,
  MicOffIcon,
  PeopleIcon,
  ScreenShareIcon,
  TranscriptIcon,
} from './icons'

export interface ToolbarProps {
  localMedia: UseLocalMediaResult
  isCameraEnabled: boolean
  isMicrophoneEnabled: boolean
  isScreensharing: boolean
  isTranscribing: boolean
  isBoardOpen: boolean
  /** Someone else is drawing right now — pulse the Board button */
  isBoardActive: boolean
  onToggleBoard: () => void
  /** Mobile: Share (doesn't work there) and People (lives in the sidebar tabs) are hidden */
  isMobile: boolean
  activePanel: 'chat' | 'people' | null
  unreadChatCount: number
  onToggleCamera: () => void
  onToggleMicrophone: () => void
  onToggleScreenshare: () => void
  onToggleTranscription: () => void
  onToggleChat: () => void
  onTogglePeople: () => void
  onLeave: () => void
}

type Variant = 'default' | 'off' | 'active' | 'danger'

const VARIANT_STYLES: Record<Variant, string> = {
  default: 'bg-zinc-900 text-zinc-100 hover:bg-zinc-800',
  off: 'bg-red-500 text-white hover:bg-red-400',
  active: 'bg-brand-500 text-brand-950 hover:bg-brand-400',
  danger: 'bg-zinc-900 text-red-400 hover:bg-red-500 hover:text-white',
}

function ToolbarButton({
  icon,
  label,
  onClick,
  variant = 'default',
  badge,
  pulse = false,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  variant?: Variant
  badge?: number
  pulse?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5"
      aria-label={label}
    >
      <span
        className={`relative flex size-10 items-center justify-center rounded-xl text-base shadow-lg shadow-black/30 transition duration-200 active:scale-90 sm:size-12 sm:rounded-2xl sm:text-lg ${VARIANT_STYLES[variant]} ${pulse ? 'pulse-ring text-brand-400' : ''}`}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="pop-in absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold text-brand-950">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium text-zinc-400 transition group-hover:text-zinc-200 sm:text-[11px]">
        {label}
      </span>
    </button>
  )
}

/** Cam/Mic button with an attached chevron that pops out a device picker. */
function DeviceToolbarButton({
  icon,
  label,
  menuLabel,
  onClick,
  variant,
  sections,
}: {
  icon: ReactNode
  label: string
  menuLabel: string
  onClick: () => void
  variant: Variant
  sections: DeviceMenuSection[]
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Dismiss on outside click or Escape. The container includes the chevron,
  // so toggling via the chevron never counts as an outside click.
  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <div ref={containerRef} className="relative flex flex-col items-center gap-1.5">
      {menuOpen && <DeviceMenu sections={sections} onClose={() => setMenuOpen(false)} />}
      <div
        className={`flex items-stretch overflow-hidden rounded-xl shadow-lg shadow-black/30 transition duration-200 sm:rounded-2xl ${VARIANT_STYLES[variant]}`}
      >
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="flex size-10 items-center justify-center text-base transition active:scale-90 sm:size-12 sm:text-lg"
        >
          {icon}
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuLabel}
          aria-expanded={menuOpen}
          className="flex w-5 items-center justify-center border-l border-black/20 transition hover:brightness-110 sm:w-6"
        >
          <ChevronDownIcon
            width="0.9em"
            height="0.9em"
            className={`transition-transform duration-200 ${menuOpen ? '' : 'rotate-180'}`}
          />
        </button>
      </div>
      <span className="text-[10px] font-medium text-zinc-400 sm:text-[11px]">{label}</span>
    </div>
  )
}

export default function Toolbar({
  localMedia,
  isCameraEnabled,
  isMicrophoneEnabled,
  isScreensharing,
  isTranscribing,
  isBoardOpen,
  isBoardActive,
  onToggleBoard,
  isMobile,
  activePanel,
  unreadChatCount,
  onToggleCamera,
  onToggleMicrophone,
  onToggleScreenshare,
  onToggleTranscription,
  onToggleChat,
  onTogglePeople,
  onLeave,
}: ToolbarProps) {
  const { state: media, actions: mediaActions } = localMedia
  // getDisplayMedia is missing on iOS Safari — no point showing a dead button
  const canScreenshare =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getDisplayMedia)

  return (
    <div className="flex items-start justify-center gap-2 px-2 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-3 sm:px-4">
      <DeviceToolbarButton
        icon={isCameraEnabled ? <CameraIcon /> : <CameraOffIcon />}
        label="Cam"
        menuLabel="Choose camera"
        variant={isCameraEnabled ? 'default' : 'off'}
        onClick={onToggleCamera}
        sections={[
          {
            title: 'Camera',
            devices: media.cameraDevices,
            currentDeviceId: media.currentCameraDeviceId,
            onSelect: mediaActions.setCameraDevice,
          },
        ]}
      />
      <DeviceToolbarButton
        icon={isMicrophoneEnabled ? <MicIcon /> : <MicOffIcon />}
        label="Mic"
        menuLabel="Choose microphone or speaker"
        variant={isMicrophoneEnabled ? 'default' : 'off'}
        onClick={onToggleMicrophone}
        sections={[
          {
            title: 'Microphone',
            devices: media.microphoneDevices,
            currentDeviceId: media.currentMicrophoneDeviceId,
            onSelect: mediaActions.setMicrophoneDevice,
          },
          {
            title: 'Speaker',
            devices: media.speakerDevices,
            currentDeviceId: media.currentSpeakerDeviceId,
            onSelect: mediaActions.setSpeakerDevice,
          },
        ]}
      />
      {!isMobile && canScreenshare && (
        <ToolbarButton
          icon={<ScreenShareIcon />}
          label={isScreensharing ? 'Stop' : 'Share'}
          variant={isScreensharing ? 'active' : 'default'}
          onClick={onToggleScreenshare}
        />
      )}
      <ToolbarButton
        icon={<BoardIcon />}
        label="Board"
        variant={isBoardOpen ? 'active' : 'default'}
        pulse={isBoardActive && !isBoardOpen}
        onClick={onToggleBoard}
      />
      <ToolbarButton
        icon={<TranscriptIcon />}
        label="Transcript"
        variant={isTranscribing ? 'active' : 'default'}
        onClick={onToggleTranscription}
      />
      <ToolbarButton
        icon={<ChatIcon />}
        label="Chat"
        variant={activePanel === 'chat' ? 'active' : 'default'}
        badge={activePanel === 'chat' ? undefined : unreadChatCount}
        onClick={onToggleChat}
      />
      {!isMobile && (
        <ToolbarButton
          icon={<PeopleIcon />}
          label="People"
          variant={activePanel === 'people' ? 'active' : 'default'}
          onClick={onTogglePeople}
        />
      )}
      <ToolbarButton icon={<LeaveIcon />} label="Leave" variant="danger" onClick={onLeave} />
    </div>
  )
}
