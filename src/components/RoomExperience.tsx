import { useState } from 'react'
import { useLocalMedia } from '@whereby.com/browser-sdk/react'
import PreJoinLobby from './PreJoinLobby'
import Call from './Call'

interface RoomExperienceProps {
  roomUrl: string
  onExit: () => void
}

const DISPLAY_NAME_KEY = 'fresh-wb-ui:display-name'

/**
 * Owns the local media for the whole room visit. useLocalMedia stays mounted
 * across lobby → call so device choices and mute state carry over, handed to
 * useRoomConnection via its localMedia option.
 */
export default function RoomExperience({ roomUrl, onExit }: RoomExperienceProps) {
  const localMedia = useLocalMedia({ audio: true, video: true })
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem(DISPLAY_NAME_KEY) ?? '',
  )
  const [phase, setPhase] = useState<'lobby' | 'call'>('lobby')
  // Bumping the key remounts Call → fresh room connection. Needed when the
  // mic is acquired mid-call: the SDK can't add a new audio track to a live
  // RTC connection, only a rejoin renegotiates it in.
  const [callGeneration, setCallGeneration] = useState(0)

  if (phase === 'lobby') {
    return (
      <PreJoinLobby
        localMedia={localMedia}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        onJoin={() => {
          localStorage.setItem(DISPLAY_NAME_KEY, displayName)
          setPhase('call')
        }}
        onBack={onExit}
      />
    )
  }

  return (
    <Call
      key={callGeneration}
      roomUrl={roomUrl}
      localMedia={localMedia}
      displayName={displayName.trim() || 'Guest'}
      onRejoin={() => setCallGeneration((generation) => generation + 1)}
      onLeave={onExit}
    />
  )
}
