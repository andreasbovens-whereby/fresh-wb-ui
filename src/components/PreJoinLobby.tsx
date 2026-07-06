import { useState, type ReactNode } from 'react'
import { VideoView, type UseLocalMediaResult } from '@whereby.com/browser-sdk/react'
import { playTestSound } from '../lib/speakerTest'
import { shouldMirror } from '../lib/cameraFacing'
import { getLiveAudioTrack, requestMicrophoneAccess } from '../lib/micAccess'
import {
  CameraIcon,
  CameraOffIcon,
  ChevronDownIcon,
  MicIcon,
  MicOffIcon,
  SpeakerIcon,
  SpinnerIcon,
} from './icons'

interface PreJoinLobbyProps {
  localMedia: UseLocalMediaResult
  displayName: string
  onDisplayNameChange: (name: string) => void
  onJoin: () => void
  onBack: () => void
}

function DeviceSelect({
  icon,
  label,
  devices,
  currentDeviceId,
  onChange,
  extra,
}: {
  icon: ReactNode
  label: string
  devices: MediaDeviceInfo[]
  currentDeviceId?: string
  onChange: (deviceId: string) => void
  extra?: ReactNode
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-zinc-700/80 bg-zinc-900 px-4 py-3 transition focus-within:border-brand-500/60">
      <span className="text-zinc-400">{icon}</span>
      <span className="sr-only">{label}</span>
      <div className="relative min-w-0 flex-1">
        <select
          value={currentDeviceId ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none truncate bg-transparent pr-7 text-sm text-zinc-100 outline-none"
        >
          {devices.length === 0 && <option value="">No {label.toLowerCase()} found</option>}
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900">
              {d.label || `${label} ${d.deviceId.slice(0, 6)}`}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 text-zinc-500" />
      </div>
      {extra}
    </label>
  )
}

function PreviewToggle({
  active,
  onClick,
  onIcon,
  offIcon,
  label,
}: {
  active: boolean
  onClick: () => void
  onIcon: ReactNode
  offIcon: ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={!active}
      className={`flex size-12 items-center justify-center rounded-xl backdrop-blur transition ${
        active
          ? 'bg-zinc-900/60 text-white hover:bg-zinc-900/80'
          : 'bg-red-500/90 text-white hover:bg-red-500'
      }`}
    >
      {active ? onIcon : offIcon}
    </button>
  )
}

export default function PreJoinLobby({
  localMedia,
  displayName,
  onDisplayNameChange,
  onJoin,
  onBack,
}: PreJoinLobbyProps) {
  const { state, actions } = localMedia
  const [cameraOn, setCameraOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [testingSpeaker, setTestingSpeaker] = useState(false)
  const [micRequest, setMicRequest] = useState<'idle' | 'requesting' | 'blocked'>('idle')
  // Only warn when we truly have no media — transient per-device errors stick
  // around in SDK state even after a successful getUserMedia (seen on iOS),
  // so a working localStream must suppress the banner.
  const mediaError =
    !state.localStream &&
    !state.isStarting &&
    Boolean(state.startError || state.cameraDeviceError || state.microphoneDeviceError)
  // The SDK falls back to camera-only when the mic request fails, without
  // surfacing any error — catch that here, before joining a silent call.
  const micMissing = Boolean(state.localStream) && !getLiveAudioTrack(state.localStream)

  async function enableMicrophone() {
    setMicRequest('requesting')
    const result = await requestMicrophoneAccess(localMedia)
    setMicRequest(result === 'blocked' ? 'blocked' : 'idle')
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-10">
      <main className="fade-in w-full max-w-md">
        {Boolean(mediaError) && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Couldn’t access your camera or microphone — check the browser’s permission settings.
            You can still join and turn on devices later.
          </div>
        )}

        {micMissing && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {micRequest === 'blocked' ? (
              <>
                Microphone access is blocked for this site. On iPhone: tap{' '}
                <span className="font-semibold">ᴀA</span> in the address bar → Website Settings →
                Microphone → Allow, then reload.
              </>
            ) : (
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  No microphone yet — if you join now, nobody will hear you.
                </span>
                <button
                  type="button"
                  disabled={micRequest === 'requesting'}
                  onClick={enableMicrophone}
                  className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-300 active:scale-95 disabled:opacity-50"
                >
                  {micRequest === 'requesting' ? 'Requesting…' : 'Enable mic'}
                </button>
              </div>
            )}
          </div>
        )}
        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/50">
          <div className="relative aspect-[4/3] bg-zinc-950">
            {state.localStream && cameraOn ? (
              <VideoView muted mirror={shouldMirror(state.localStream)} stream={state.localStream} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
                {state.isStarting ? (
                  <>
                    <SpinnerIcon width="2em" height="2em" />
                    <p className="text-sm">Starting camera…</p>
                  </>
                ) : (
                  <>
                    <CameraOffIcon width="2em" height="2em" />
                    <p className="text-sm">Camera is off</p>
                  </>
                )}
              </div>
            )}

            <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
              <PreviewToggle
                active={cameraOn}
                onClick={() => {
                  actions.toggleCameraEnabled(!cameraOn)
                  setCameraOn(!cameraOn)
                }}
                onIcon={<CameraIcon />}
                offIcon={<CameraOffIcon />}
                label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
              />
              <PreviewToggle
                active={micOn}
                onClick={() => {
                  actions.toggleMicrophoneEnabled(!micOn)
                  setMicOn(!micOn)
                }}
                onIcon={<MicIcon />}
                offIcon={<MicOffIcon />}
                label={micOn ? 'Mute microphone' : 'Unmute microphone'}
              />
            </div>
          </div>

          <div className="space-y-3 p-5">
            <input
              type="text"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              placeholder="Your name"
              maxLength={50}
              className="w-full rounded-2xl border border-zinc-700/80 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/25"
            />

            <DeviceSelect
              icon={<CameraIcon />}
              label="Camera"
              devices={state.cameraDevices}
              currentDeviceId={state.currentCameraDeviceId}
              onChange={actions.setCameraDevice}
            />
            <DeviceSelect
              icon={<MicIcon />}
              label="Microphone"
              devices={state.microphoneDevices}
              currentDeviceId={state.currentMicrophoneDeviceId}
              onChange={actions.setMicrophoneDevice}
            />
            <DeviceSelect
              icon={<SpeakerIcon />}
              label="Speaker"
              devices={state.speakerDevices}
              currentDeviceId={state.currentSpeakerDeviceId}
              onChange={actions.setSpeakerDevice}
              extra={
                <button
                  type="button"
                  disabled={testingSpeaker}
                  onClick={async () => {
                    setTestingSpeaker(true)
                    try {
                      await playTestSound(state.currentSpeakerDeviceId)
                    } finally {
                      setTestingSpeaker(false)
                    }
                  }}
                  className="shrink-0 text-sm font-medium text-brand-400 transition hover:text-brand-300 disabled:opacity-50"
                >
                  {testingSpeaker ? 'Playing…' : 'Test'}
                </button>
              }
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onJoin}
          className="mt-5 w-full rounded-2xl bg-brand-500 py-4 text-sm font-semibold text-brand-950 transition hover:bg-brand-400 focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
        >
          Join meeting
        </button>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 w-full rounded-2xl py-3 text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          Back
        </button>
      </main>
    </div>
  )
}
