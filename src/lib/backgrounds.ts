export type BackgroundChoice =
  | { type: 'image'; id: string }
  | { type: 'color'; hex: string }
  | null

export interface BackgroundImage {
  id: string
  label: string
  url: string
  /** Unsplash photographer, for attribution (also credited in the README) */
  credit: string
  creditUrl: string
}

// BASE_URL matters: GitHub Pages serves the app under /<repo>/
const assetUrl = (file: string) => `${import.meta.env.BASE_URL}backgrounds/${file}`

export const BACKGROUND_IMAGES: BackgroundImage[] = [
  {
    id: 'mountains',
    label: 'Mountains',
    url: assetUrl('mountains.avif'),
    credit: 'Kalen Emsley',
    creditUrl: 'https://unsplash.com/@kalenemsley',
  },
  {
    id: 'beach',
    label: 'Beach',
    url: assetUrl('beach.avif'),
    credit: 'Sean Oulashin',
    creditUrl: 'https://unsplash.com/@oulashin',
  },
  {
    id: 'hills',
    label: 'Hills',
    url: assetUrl('hills.avif'),
    credit: 'Claudio Testa',
    creditUrl: 'https://unsplash.com/@claudiotesta',
  },
  {
    id: 'river',
    label: 'River',
    url: assetUrl('river.avif'),
    credit: 'Hendrik Cornelissen',
    creditUrl: 'https://unsplash.com/@the_bracketeer',
  },
]

export const BACKGROUND_COLORS = [
  '#d9ed92',
  '#b5e48c',
  '#99d98c',
  '#76c893',
  '#52b69a',
  '#34a0a4',
  '#168aad',
  '#1a759f',
  '#1e6091',
  '#184e77',
]

const STORAGE_KEY = 'fresh-wb-ui:background'

export function loadBackground(): BackgroundChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BackgroundChoice
    if (parsed?.type === 'image' && BACKGROUND_IMAGES.some((i) => i.id === parsed.id)) {
      return parsed
    }
    if (parsed?.type === 'color' && BACKGROUND_COLORS.includes(parsed.hex)) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function saveBackground(choice: BackgroundChoice): void {
  try {
    if (choice) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // best effort
  }
}
