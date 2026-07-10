import emojiShortcodes from './emojiShortcodes.json'

const shortcodes = emojiShortcodes as Record<string, string>
const shortcodeEntries = Object.entries(shortcodes)

const SHORTCODE_PATTERN = /:([a-z0-9_+-]+):/gi

/** Replaces Slack/GitHub-style `:shortcode:` tokens with their emoji character. */
export function replaceEmojiShortcodes(text: string): string {
  return text.replace(SHORTCODE_PATTERN, (match, name: string) => shortcodes[name.toLowerCase()] ?? match)
}

/**
 * Finds the `:partial` shortcode being typed right before the caret, if any
 * — an unclosed `:` (no matching closing `:` yet) followed only by valid
 * shortcode characters. Used to drive the autocomplete popup.
 */
export function findActiveShortcodeQuery(text: string, caret: number): { start: number; query: string } | null {
  const upToCaret = text.slice(0, caret)
  const colonIndex = upToCaret.lastIndexOf(':')
  if (colonIndex === -1) return null
  const query = upToCaret.slice(colonIndex + 1)
  if (!/^[a-z0-9_+-]*$/i.test(query)) return null
  return { start: colonIndex, query }
}

/** Shortcodes starting with (then containing) `query`, shortest/alphabetical first. */
export function searchEmojiShortcodes(query: string, limit = 8): [name: string, emoji: string][] {
  if (!query) return []
  const q = query.toLowerCase()
  const starts: [string, string][] = []
  const contains: [string, string][] = []
  for (const entry of shortcodeEntries) {
    if (entry[0].startsWith(q)) starts.push(entry)
    else if (entry[0].includes(q)) contains.push(entry)
  }
  const byRelevance = (a: [string, string], b: [string, string]) => a[0].length - b[0].length || a[0].localeCompare(b[0])
  starts.sort(byRelevance)
  contains.sort(byRelevance)
  return [...starts, ...contains].slice(0, limit)
}

// Combining/joining characters used to keep multi-codepoint emoji (skin
// tones, ZWJ sequences like families, keycaps, flags) as one grapheme.
const VARIATION_SELECTOR = '\u{FE0F}'
const ZWJ = '\u{200D}'
const KEYCAP = '\u{20E3}'

const EMOJI_ONLY_PATTERN = new RegExp(
  `^(?:\\p{Extended_Pictographic}(?:\\p{Emoji_Modifier}|${VARIATION_SELECTOR}|${ZWJ}\\p{Extended_Pictographic}(?:\\p{Emoji_Modifier}|${VARIATION_SELECTOR})?)*` +
    `|\\p{Regional_Indicator}{2}` +
    `|[0-9#*]${VARIATION_SELECTOR}?${KEYCAP})$`,
  'u',
)

/** True if `text` is exactly one emoji (any surrounding whitespace ignored) — not text containing one, not two side by side. */
export function isSingleEmoji(text: string): boolean {
  if (typeof Intl.Segmenter !== 'function') return false // older Firefox (<125) lacks it — fall back to the normal bubble
  const trimmed = text.trim()
  if (!trimmed) return false
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(trimmed)]
  if (segments.length !== 1) return false
  return EMOJI_ONLY_PATTERN.test(segments[0].segment)
}
