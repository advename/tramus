/**
 * Design tokens straight from `designs/Tramus Design.dc.html` §9 (Design tokens → MUI theme),
 * as oklch strings. MUI's colour utilities (`alpha`, `darken`, `lighten`, contrast checks…)
 * cannot parse oklch, so these are converted to sRGB hex by `theme/color.ts` before they reach
 * `createAppTheme`. Never hand-edit a hex value elsewhere — change it here.
 */

export interface ThemeTokens {
  background: { default: string; paper: string }
  surface: { raised: string; hover: string; lineStrong: string; dim: string }
  divider: string
  text: { primary: string; secondary: string; disabled: string }
  primary: { main: string; contrastText: string }
  secondary: { main: string }
  warning: { main: string }
  error: { main: string }
  success: { main: string }
  canvas: string
}

export const darkTokens: ThemeTokens = {
  background: { default: 'oklch(0.165 0.005 70)', paper: 'oklch(0.2 0.006 70)' },
  surface: {
    raised: 'oklch(0.245 0.007 70)',
    hover: 'oklch(0.28 0.008 70)',
    lineStrong: 'oklch(0.37 0.008 70)',
    dim: 'oklch(0.12 0.004 70 / 0.62)'
  },
  divider: 'oklch(0.3 0.007 70)',
  text: {
    primary: 'oklch(0.94 0.01 85)',
    secondary: 'oklch(0.76 0.012 80)',
    disabled: 'oklch(0.63 0.01 75)'
  },
  primary: { main: 'oklch(0.87 0.05 82)', contrastText: 'oklch(0.2 0.01 70)' },
  secondary: { main: 'oklch(0.76 0.012 80)' },
  warning: { main: 'oklch(0.8 0.15 75)' },
  error: { main: 'oklch(0.7 0.18 25)' },
  success: { main: 'oklch(0.77 0.12 155)' },
  canvas: 'oklch(0.13 0.004 70)'
}

export const lightTokens: ThemeTokens = {
  background: { default: 'oklch(0.95 0.006 85)', paper: 'oklch(0.985 0.004 85)' },
  surface: {
    raised: 'oklch(0.935 0.007 85)',
    hover: 'oklch(0.91 0.008 85)',
    lineStrong: 'oklch(0.8 0.01 80)',
    dim: 'oklch(0.97 0.004 85 / 0.72)'
  },
  divider: 'oklch(0.88 0.008 80)',
  text: {
    primary: 'oklch(0.22 0.01 70)',
    secondary: 'oklch(0.43 0.012 70)',
    disabled: 'oklch(0.52 0.01 70)'
  },
  primary: { main: 'oklch(0.32 0.025 60)', contrastText: 'oklch(0.97 0.01 85)' },
  secondary: { main: 'oklch(0.43 0.012 70)' },
  warning: { main: 'oklch(0.55 0.13 65)' },
  error: { main: 'oklch(0.52 0.19 25)' },
  success: { main: 'oklch(0.5 0.11 155)' },
  canvas: 'oklch(0.9 0.006 85)'
}

/**
 * `palette.zones[0..7]` — fixed, named colours for zone outlines/fills. Same in both themes:
 * they're drawn over video frames, not over the app chrome. Order matches the design's swatches
 * and is the order zones are assigned a colour when created.
 */
export const zoneTokens: readonly { name: string; color: string }[] = [
  { name: 'Sky', color: 'oklch(0.8 0.12 235)' },
  { name: 'Teal', color: 'oklch(0.77 0.13 172)' },
  { name: 'Violet', color: 'oklch(0.7 0.17 300)' },
  { name: 'Lime', color: 'oklch(0.88 0.17 122)' },
  { name: 'Orchid', color: 'oklch(0.75 0.15 350)' },
  { name: 'Blue', color: 'oklch(0.63 0.16 262)' },
  { name: 'Ice', color: 'oklch(0.92 0.05 205)' },
  { name: 'Green', color: 'oklch(0.65 0.12 148)' }
]

/** Movement trail overlay colour. Reserved — used nowhere else in the UI. Same in both themes. */
export const trailToken = 'oklch(0.64 0.23 27)'

/** Live tracker-detection overlay colour ("what the tracker sees"). Same in both themes. */
export const detectionToken = 'oklch(0.8 0.15 150)'
