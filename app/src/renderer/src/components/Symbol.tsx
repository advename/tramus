import { forwardRef } from 'react'
import Box, { type BoxProps } from '@mui/material/Box'

import { extendSx } from '../lib/sx'

export interface SymbolProps extends Omit<BoxProps<'span'>, 'children'> {
  /**
   * A Material Symbols Outlined icon name, e.g. `"arrow_selector_tool"`, `"highlight_alt"`,
   * `"pentagon"`, `"my_location"`, `"linear_scale"`. Browse names at
   * https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Outlined.
   */
  name: string
  /** Pixel size (also drives the variable font's `opsz` axis). Default 20. */
  size?: number
  /** Solid vs outline glyph (the `FILL` axis). Default false. */
  fill?: boolean
  /** Stroke weight (the `wght` axis). Default 400. */
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700
  /** Emphasis (the `GRAD` axis); negative values are lighter. Default 0. */
  grade?: -50 | 0 | 200
}

/**
 * A Material Symbols Outlined glyph. The font is bundled locally (`main.tsx` imports
 * `material-symbols/outlined.css`) so the app works offline — never load it from Google Fonts.
 */
export const Symbol = forwardRef<HTMLSpanElement, SymbolProps>(function Symbol(
  { name, size = 20, fill = false, weight = 400, grade = 0, sx, ...rest },
  ref
) {
  return (
    <Box
      ref={ref}
      component="span"
      aria-hidden
      {...rest}
      sx={[
        {
          fontFamily: '"Material Symbols Outlined"',
          fontWeight: 'normal',
          fontStyle: 'normal',
          display: 'inline-flex',
          lineHeight: 1,
          fontSize: size,
          userSelect: 'none',
          whiteSpace: 'nowrap',
          wordWrap: 'normal',
          flexShrink: 0,
          fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${size}`
        },
        ...extendSx(sx)
      ]}
    >
      {name}
    </Box>
  )
})
