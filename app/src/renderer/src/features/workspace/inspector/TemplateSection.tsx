import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'

import type { Setup } from '../../../api/types'
import { Symbol } from '../../../components/Symbol'
import type { SessionActions } from '../data'
import { LoadTemplateMenu } from './LoadTemplateMenu'
import { SaveAsTemplateDialog } from './SaveAsTemplateDialog'
import { SectionHeader } from './SectionHeader'

export interface TemplateSectionProps {
  videoId: string
  setup: Setup
  applyTemplate: SessionActions['applyTemplate']
}

/** "From “…”" label + Save as template / Load template (design: `Template` section). */
export function TemplateSection({
  videoId,
  setup,
  applyTemplate
}: TemplateSectionProps): React.JSX.Element {
  const [saveOpen, setSaveOpen] = useState(false)
  const [loadAnchor, setLoadAnchor] = useState<HTMLElement | null>(null)

  return (
    <Box sx={{ px: 1.75, pb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <SectionHeader
        title="Template"
        info="A saved setup (arena, zones, scale and settings) that you can reuse on other videos."
        sx={{ px: 0, pb: 0.25 }}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          fontSize: 12,
          color: 'text.secondary'
        }}
      >
        <Symbol name="bookmarks" size={16} />
        {setup.template ? `From “${setup.template.name}”` : 'No template applied'}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
        <Button variant="outlined" onClick={() => setSaveOpen(true)}>
          Save as template…
        </Button>
        <Button variant="outlined" onClick={(e) => setLoadAnchor(e.currentTarget)}>
          Load template…
        </Button>
      </Box>

      <SaveAsTemplateDialog open={saveOpen} videoId={videoId} onClose={() => setSaveOpen(false)} />
      <LoadTemplateMenu
        anchorEl={loadAnchor}
        onClose={() => setLoadAnchor(null)}
        onSelect={(templateId) => void applyTemplate(templateId)}
      />
    </Box>
  )
}
