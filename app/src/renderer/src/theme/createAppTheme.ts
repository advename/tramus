import type { CSSProperties } from 'react'

import { createTheme, type Theme } from '@mui/material/styles'
import type {} from '@mui/x-data-grid/themeAugmentation'
import type {} from '@mui/x-charts/themeAugmentation'

import { oklchToRgb } from './color'
import {
  darkTokens,
  detectionToken,
  lightTokens,
  trailToken,
  zoneTokens,
  type ThemeTokens
} from './tokens'

export type ThemeMode = 'dark' | 'light'

// Module augmentation: the design's tokens that don't map to a stock MUI palette/typography
// slot. Every feature screen should reach for these instead of hard-coding a colour — see
// app/README.md.
declare module '@mui/material/styles' {
  interface Palette {
    /** `palette.zones[0..7]` — fixed zone outline/fill colours, in assignment order. */
    zones: string[]
    /** Movement-trail overlay colour. Reserved: used nowhere else. */
    trail: string
    /** Live tracker-detection overlay colour ("what the tracker sees"). */
    detection: string
    /** Video-stage backdrop, behind letterboxed frames. */
    canvas: string
    /** Extra flat-surface steps the design uses beyond background/paper. */
    surface: {
      /** Selected/raised rows, panels, the app-shell nav rail. */
      raised: string
      hover: string
      /** Stronger divider used for input borders. */
      lineStrong: string
      /** Translucent scrim, e.g. behind modal-ish overlays on the canvas. */
      dim: string
    }
  }
  interface PaletteOptions {
    zones?: string[]
    trail?: string
    detection?: string
    canvas?: string
    surface?: {
      raised: string
      hover: string
      lineStrong: string
      dim: string
    }
  }
  interface TypographyVariants {
    /** IBM Plex Mono, tabular-nums — every numeric readout (times, pixel values, counters). */
    mono: CSSProperties
  }
  interface TypographyVariantsOptions {
    mono?: CSSProperties
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    mono: true
  }
}

function buildPalette(mode: ThemeMode, t: ThemeTokens) {
  return {
    mode,
    background: {
      default: oklchToRgb(t.background.default),
      paper: oklchToRgb(t.background.paper)
    },
    divider: oklchToRgb(t.divider),
    text: {
      primary: oklchToRgb(t.text.primary),
      secondary: oklchToRgb(t.text.secondary),
      disabled: oklchToRgb(t.text.disabled)
    },
    primary: {
      main: oklchToRgb(t.primary.main),
      contrastText: oklchToRgb(t.primary.contrastText)
    },
    secondary: { main: oklchToRgb(t.secondary.main) },
    warning: { main: oklchToRgb(t.warning.main) },
    error: { main: oklchToRgb(t.error.main) },
    success: { main: oklchToRgb(t.success.main) },
    canvas: oklchToRgb(t.canvas),
    trail: oklchToRgb(trailToken),
    detection: oklchToRgb(detectionToken),
    zones: zoneTokens.map((z) => oklchToRgb(z.color)),
    surface: {
      raised: oklchToRgb(t.surface.raised),
      hover: oklchToRgb(t.surface.hover),
      lineStrong: oklchToRgb(t.surface.lineStrong),
      dim: oklchToRgb(t.surface.dim)
    }
  }
}

/**
 * Builds the light or dark MUI theme from the design tokens (`theme/tokens.ts`). See
 * `designs/Tramus Design.dc.html` §9 for the source spacing/typography/density table this
 * mirrors, including the `theme.ts` excerpt this function is a faithful TypeScript port of.
 */
export function createAppTheme(mode: ThemeMode): Theme {
  const tokens = mode === 'dark' ? darkTokens : lightTokens
  const palette = buildPalette(mode, tokens)

  return createTheme({
    cssVariables: true,
    palette,
    spacing: 4,
    shape: { borderRadius: 6 },
    typography: {
      fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      fontSize: 13,
      h5: { fontSize: 16, fontWeight: 600 },
      h6: { fontSize: 15, fontWeight: 600 },
      subtitle2: { fontSize: 13, fontWeight: 500 },
      body2: { fontSize: 13 },
      caption: { fontSize: 11.5 },
      overline: { fontSize: 11, fontWeight: 600, letterSpacing: '.06em' },
      mono: {
        fontFamily: '"IBM Plex Mono", monospace',
        fontVariantNumeric: 'tabular-nums'
      }
    },
    components: {
      MuiButton: {
        defaultProps: { size: 'small', disableElevation: true },
        styleOverrides: { root: { textTransform: 'none', height: 28 } }
      },
      MuiIconButton: { defaultProps: { size: 'small' } },
      MuiTooltip: { defaultProps: { enterDelay: 500, arrow: false } },
      MuiList: { defaultProps: { dense: true } },
      MuiSlider: { defaultProps: { size: 'small' } },
      MuiDataGrid: { defaultProps: { density: 'compact' } },
      MuiPaper: { defaultProps: { elevation: 0 } },
      MuiChip: { styleOverrides: { root: { borderRadius: 999 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 12 } } },
      MuiMenu: { styleOverrides: { paper: { borderRadius: 8 } } },
      MuiPopover: { styleOverrides: { paper: { borderRadius: 8 } } },
      MuiCard: { styleOverrides: { root: { borderRadius: 10 } } }
    }
  })
}
