import { CheckIcon } from './icons'

export interface DeviceMenuSection {
  title: string
  devices: MediaDeviceInfo[]
  currentDeviceId?: string
  onSelect: (deviceId: string) => void
}

interface DeviceMenuProps {
  sections: DeviceMenuSection[]
  onClose: () => void
}

/**
 * Popout listing devices, anchored above a toolbar button. Purely
 * presentational — outside-click/Escape dismissal lives in the anchor
 * component, whose container includes the toggle chevron (otherwise clicking
 * the chevron would close-then-reopen the menu).
 */
export default function DeviceMenu({ sections, onClose }: DeviceMenuProps) {
  return (
    <div className="pop-in absolute bottom-[calc(100%+0.75rem)] left-0 z-30 w-72 max-w-[calc(100vw-1rem)] rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-2 shadow-2xl shadow-black/50 backdrop-blur sm:left-1/2 sm:-translate-x-1/2">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">
            {section.title}
          </p>
          {section.devices.length === 0 && (
            <p className="px-3 pb-2 text-sm text-zinc-500">No devices found</p>
          )}
          {section.devices.map((d) => {
            const isCurrent = d.deviceId === section.currentDeviceId
            return (
              <button
                key={d.deviceId}
                type="button"
                onClick={() => {
                  section.onSelect(d.deviceId)
                  onClose()
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
              >
                <span className={`shrink-0 text-brand-400 ${isCurrent ? '' : 'invisible'}`}>
                  <CheckIcon width="1em" height="1em" />
                </span>
                <span className="truncate">
                  {d.label || `Device ${d.deviceId.slice(0, 6)}`}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
