import { useEffect, useState } from 'react'
import JoinForm from './components/JoinForm'
import RoomExperience from './components/RoomExperience'
import { addRecentUrl } from './lib/recentUrls'

/**
 * Deep link support: /#url=<roomUrl> skips the form. The fragment form keeps
 * the roomKey off the wire — fragments are never sent in HTTP requests or
 * referrers. Legacy /?url=… links are still accepted and migrated to the
 * fragment. Room URLs carry their own query (?roomKey=…), so when the link
 * isn't URL-encoded its params can end up split off — reattach any extras so
 * both encoded and unencoded links work.
 */
function extractRoomUrl(params: URLSearchParams): string | null {
  const raw = params.get('url')
  if (!raw) return null
  let roomUrl: URL
  try {
    roomUrl = new URL(raw)
  } catch {
    return null
  }
  for (const [key, value] of params) {
    if (key !== 'url' && !roomUrl.searchParams.has(key)) {
      roomUrl.searchParams.set(key, value)
    }
  }
  return roomUrl.toString()
}

function roomUrlFromLocation(): string | null {
  return (
    extractRoomUrl(new URLSearchParams(window.location.hash.replace(/^#/, ''))) ??
    extractRoomUrl(new URLSearchParams(window.location.search))
  )
}

function setUrlParam(roomUrl: string | null) {
  const pageUrl = new URL(window.location.href)
  pageUrl.search = '' // scrub the legacy query form
  pageUrl.hash = roomUrl ? `url=${encodeURIComponent(roomUrl)}` : ''
  history.replaceState(null, '', pageUrl)
}

export default function App() {
  const [roomUrl, setRoomUrl] = useState<string | null>(() => {
    const fromLink = roomUrlFromLocation()
    if (fromLink) {
      addRecentUrl(fromLink)
      // Normalize the address bar (reassembled + encoded) so a mid-call
      // refresh lands back in this room's lobby
      setUrlParam(fromLink)
    }
    return fromLink
  })

  // Hash-only navigation doesn't reload the page, so pasting a #url= link
  // into an already-open tab needs to be picked up here. Our own replaceState
  // calls never fire hashchange, so there's no loop.
  useEffect(() => {
    function onHashChange() {
      const fromLink = roomUrlFromLocation()
      if (fromLink) {
        addRecentUrl(fromLink)
        setUrlParam(fromLink)
      }
      setRoomUrl(fromLink)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function join(url: string) {
    setUrlParam(url)
    setRoomUrl(url)
  }

  function exit() {
    setUrlParam(null)
    setRoomUrl(null)
  }

  if (!roomUrl) {
    return <JoinForm onJoin={join} />
  }
  return <RoomExperience roomUrl={roomUrl} onExit={exit} />
}
