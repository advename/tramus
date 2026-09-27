import { formatHex, formatRgb, parse } from 'culori'

/**
 * Converts an oklch() CSS colour string (optionally with alpha via the "/" syntax, e.g.
 * `"oklch(0.12 0.004 70 / 0.62)"`) to sRGB, since MUI's own colour helpers (`alpha`, `darken`,
 * `lighten`, contrast calculations…) only understand hex/rgb/hsl.
 *
 * Opaque colours become a 6-digit hex string (so MUI's helpers can still adjust them);
 * translucent ones become an `rgba(...)` string, since hex can't round-trip through those
 * helpers as cleanly and every consumer here (CSS, MUI `sx`, theme palette entries) accepts it.
 */
export function oklchToRgb(token: string): string {
  const parsed = parse(token)
  if (!parsed) {
    throw new Error(`theme/color.ts: could not parse colour token "${token}"`)
  }
  if (parsed.alpha !== undefined && parsed.alpha < 1) {
    return formatRgb(parsed)
  }
  const hex = formatHex(parsed)
  if (!hex) {
    throw new Error(`theme/color.ts: could not format colour token "${token}" as hex`)
  }
  return hex
}
