import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Slider from '@mui/material/Slider'
import Typography from '@mui/material/Typography'

import type { SetupEditor } from '../data'
import type { Setup } from '../../../api/types'

export interface ImageAdjustmentsSectionProps {
  setup: Setup
  editor: SetupEditor
}

const DEFAULT_IMAGE = { brightness: 0, contrast: 0 }

/** Brightness/contrast sliders (design: `Image` section). */
export function ImageAdjustmentsSection({ setup, editor }: ImageAdjustmentsSectionProps): React.JSX.Element {
  const image = setup.image ?? DEFAULT_IMAGE

  const set = (patch: Partial<typeof image>, label: string): void => {
    editor.commitDebounced({ ...setup, image: { ...image, ...patch } }, label)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.75, pt: 1.75, pb: 1 }}>
        <Typography variant="overline" sx={{ color: 'text.disabled' }}>
          Image
        </Typography>
        <ButtonBase
          onClick={() => void editor.commit({ ...setup, image: DEFAULT_IMAGE }, 'Reset image')}
          sx={{
            height: 22,
            px: 0.75,
            borderRadius: '5px',
            fontSize: 12,
            color: 'text.secondary',
            '&:hover': { bgcolor: 'surface.hover' }
          }}
        >
          Reset
        </ButtonBase>
      </Box>
      <Box sx={{ px: 1.75, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 13 }}>Brightness</Typography>
            <Typography variant="mono" sx={{ fontSize: 12, color: 'text.secondary' }}>
              {image.brightness > 0 ? '+' : ''}
              {image.brightness}
            </Typography>
          </Box>
          <Slider
            min={-100}
            max={100}
            value={image.brightness}
            onChange={(_, value) => set({ brightness: value }, 'Adjust brightness')}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 13 }}>Contrast</Typography>
            <Typography variant="mono" sx={{ fontSize: 12, color: 'text.secondary' }}>
              {image.contrast > 0 ? '+' : ''}
              {image.contrast}
            </Typography>
          </Box>
          <Slider
            min={-100}
            max={100}
            value={image.contrast}
            onChange={(_, value) => set({ contrast: value }, 'Adjust contrast')}
          />
        </Box>
      </Box>
    </Box>
  )
}
