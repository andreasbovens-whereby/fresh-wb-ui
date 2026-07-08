import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1.25em"
      height="1.25em"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x={2.5} y={6} width={13} height={12} rx={2.5} />
      <path d="m15.5 10.5 5-3v9l-5-3" />
    </Icon>
  )
}

export function CameraOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 6h5a2.5 2.5 0 0 1 2.5 2.5v1l5-3v9l-3.4-2M15.5 15.5A2.5 2.5 0 0 1 13 18H5a2.5 2.5 0 0 1-2.5-2.5v-7A2.5 2.5 0 0 1 5 6" />
      <path d="m3 3 18 18" />
    </Icon>
  )
}

export function MicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x={9} y={3} width={6} height={11} rx={3} />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </Icon>
  )
}

export function MicOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 5a3 3 0 0 1 6 0v6c0 .5-.1 1-.35 1.44M9 9v2a3 3 0 0 0 4.6 2.54" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 10.6 5M18.5 11.5c0 .8-.15 1.57-.42 2.28M12 18v3" />
      <path d="m3 3 18 18" />
    </Icon>
  )
}

export function ScreenShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x={2.5} y={4} width={19} height={13} rx={2} />
      <path d="M9 21h6M12 17v4" />
      <path d="m9.5 10 2.5-2.5L14.5 10M12 8v5" />
    </Icon>
  )
}

export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.72-.33-3.9-.93L3.5 20.5l.93-5.1A8.5 8.5 0 1 1 21 12Z" />
    </Icon>
  )
}

export function PeopleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx={9} cy={8} r={3.2} />
      <path d="M3.2 19.5a5.8 5.8 0 0 1 11.6 0" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6M17.4 14.3a5.8 5.8 0 0 1 3.4 5.2" />
    </Icon>
  )
}

export function LeaveIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 3.5H8A2.5 2.5 0 0 0 5.5 6v12A2.5 2.5 0 0 0 8 20.5h6" />
      <path d="m16 8 4 4-4 4M20 12h-9" />
    </Icon>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  )
}

export function SpeakerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11 5 6.5 8.5H3v7h3.5L11 19V5Z" />
      <path d="M14.5 9a4.2 4.2 0 0 1 0 6M17.5 6.5a8 8 0 0 1 0 11" />
    </Icon>
  )
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m3.5 11.5 17-7.5-5 16.5-3.5-6.5-8.5-2.5Z" />
      <path d="M12 14 20.5 4" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 13 4.5 4.5L19 7" />
    </Icon>
  )
}

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 14a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.7 1.7" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.7-1.7" />
    </Icon>
  )
}

export function BoardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 17.5 15.5 6a2.1 2.1 0 0 1 3 0l-.5-.5a2.1 2.1 0 0 1 0 3L6.5 20 3 21l1-3.5Z" />
      <path d="m13.5 8 3 3" />
    </Icon>
  )
}

export function TranscriptIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x={4.5} y={3} width={15} height={18} rx={2} />
      <path d="M8 7.5h8M8 11h8M8 14.5h5" />
    </Icon>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x={9} y={9} width={11.5} height={11.5} rx={2} />
      <path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5" />
    </Icon>
  )
}

export function PipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 11V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5" />
      <rect x={12.5} y={13.5} width={8.5} height={6.5} rx={1.5} />
    </Icon>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx={12} cy={12} r={3.2} />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.85a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08c.26.63.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03Z" />
    </Icon>
  )
}

export function SpinnerIcon(props: IconProps) {
  return (
    <Icon {...props} className={`animate-spin ${props.className ?? ''}`}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Icon>
  )
}
