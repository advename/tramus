import type { Theme } from '@mui/material/styles'
import type { SxProps, SystemStyleObject } from '@mui/system/styleFunctionSx'

/**
 * `SxProps<Theme>` is `SystemStyleObject<Theme> | ((theme) => SystemStyleObject<Theme>) |
 * ReadonlyArray<boolean | SystemStyleObject<Theme> | ((theme) => SystemStyleObject<Theme>)>` —
 * a single level of array, never nested. That's what makes a component's own
 * `sx={[internalStyles, ...externalSx]}` extension pattern awkward to type: naively typing the
 * spread as `SxProps<Theme>[]` re-admits nested arrays (since `SxProps<Theme>` itself can be an
 * array) and MUI's components correctly reject that.
 *
 * `extendSx` returns exactly the flat element type `SxProps<Theme>`'s array variant expects, so
 * `sx={[internalStyles, ...extendSx(sx)]}` type-checks.
 */
type FlatSxItem = boolean | SystemStyleObject<Theme> | ((theme: Theme) => SystemStyleObject<Theme>)

export function extendSx(sx: SxProps<Theme> | undefined): FlatSxItem[] {
  if (sx === undefined) return []
  // TS can't narrow `Array.isArray` cleanly across this particular union — the runtime check is
  // exactly what makes this safe (see the comment above).
  return (Array.isArray(sx) ? sx : [sx]) as FlatSxItem[]
}
