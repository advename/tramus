import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Radio from '@mui/material/Radio'
import { alpha } from '@mui/material/styles'
import Typography from '@mui/material/Typography'

import { useApplyTemplate, useTemplates } from '../../api/queries'
import { TemplatePreview } from '../templates/TemplatePreview'
import { formatTemplateMeta } from '../templates/templateFormat'

export interface ApplyTemplateDialogProps {
  open: boolean
  videoIds: string[]
  onCancel: () => void
  onApplied: () => void
}

/** Lets the user pick a template to apply to the current Library selection. */
export function ApplyTemplateDialog({
  open,
  videoIds,
  onCancel,
  onApplied
}: ApplyTemplateDialogProps): React.JSX.Element {
  const { data: templates, isLoading } = useTemplates()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const applyTemplate = useApplyTemplate()

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Typography variant="h5" component="span">
          Apply template
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Overwrites the setup of {videoIds.length} {videoIds.length === 1 ? 'video' : 'videos'}.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 0 }}>
        {isLoading ? (
          <Typography color="text.disabled">Loading…</Typography>
        ) : !templates || templates.length === 0 ? (
          <Typography color="text.disabled">No templates saved yet.</Typography>
        ) : (
          templates.map((template) => (
            <Box
              key={template.id}
              onClick={() => setSelectedId(template.id)}
              sx={{
                display: 'grid',
                gridTemplateColumns: '18px 56px minmax(0, 1fr)',
                gap: 1.5,
                alignItems: 'center',
                p: 1,
                borderRadius: '8px',
                border: 1,
                borderColor: selectedId === template.id ? 'primary.main' : 'divider',
                bgcolor: (theme) =>
                  selectedId === template.id
                    ? alpha(theme.palette.primary.main, 0.13)
                    : 'transparent',
                cursor: 'pointer'
              }}
            >
              <Radio checked={selectedId === template.id} size="small" sx={{ p: 0 }} />
              <Box
                sx={{
                  width: 56,
                  height: 48,
                  borderRadius: '5px',
                  overflow: 'hidden',
                  bgcolor: 'canvas'
                }}
              >
                <TemplatePreview template={template} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 500 }} noWrap>
                  {template.name}
                </Typography>
                <Typography variant="caption" color="text.disabled" noWrap component="div">
                  {formatTemplateMeta(template)}
                </Typography>
              </Box>
            </Box>
          ))
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={selectedId === null || applyTemplate.isPending}
          onClick={() => {
            if (selectedId === null) return
            applyTemplate.mutate({ templateId: selectedId, videoIds }, { onSuccess: onApplied })
          }}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  )
}
