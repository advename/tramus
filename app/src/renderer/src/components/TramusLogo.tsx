// Fixed brand colours, not theme tokens: the mark is the same cream tile in both themes (and it
// renders in the engine splash, before <ThemeProvider> exists).
const TILE = 'oklch(0.87 0.05 82)'
const INK = 'oklch(0.2 0.01 70)'

export interface TramusLogoProps {
  /** Pixel size of the square tile. */
  size: number
}

/**
 * The Tramus mark — logo 1b "Subject dot" from `designs/Tramus Logos.dc.html`: a T whose stem
 * stops short of a dot, the tracked animal. `build/icon.svg` (the app icon source) draws the
 * same geometry; keep the two in sync.
 */
export function TramusLogo({ size }: TramusLogoProps): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Tramus"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="64" height="64" rx="15" fill={TILE} />
      <rect x="16" y="16" width="32" height="6.5" fill={INK} />
      <rect x="28.75" y="16" width="6.5" height="21" fill={INK} />
      <circle cx="32" cy="45" r="4.6" fill={INK} />
    </svg>
  )
}
