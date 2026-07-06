const STORAGE_KEY = 'fresh-wb-ui:recent-room-urls'
const MAX_URLS = 10

export function getRecentUrls(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === 'string') : []
  } catch {
    return []
  }
}

function save(urls: string[]): string[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(urls))
  } catch {
    // storage full/unavailable — recents are best-effort
  }
  return urls
}

/** Adds a URL to the top of the list, deduping on exact match, capped at 10. */
export function addRecentUrl(url: string): string[] {
  const rest = getRecentUrls().filter((u) => u !== url)
  return save([url, ...rest].slice(0, MAX_URLS))
}

export function removeRecentUrl(url: string): string[] {
  return save(getRecentUrls().filter((u) => u !== url))
}
