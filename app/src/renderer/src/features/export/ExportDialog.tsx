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

import { useExportVideos, useSettings, useUpdateSettings } from '../../api/queries'
import type { ExportFormat, ExportLayout } from '../../api/types'
import { Symbol } from '../../components/Symbol'
import { notify, notifyError } from '../../stores/notifications'

const FORMAT_OPTIONS: { value: ExportFormat; label: string; help: string }[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)', help: 'One workbook with a sheet per table.' },
  { value: 'csv', label: 'CSV', help: 'A few .csv files next to each other, UTF-8 with a BOM.' }
]

const LAYOUT_OPTIONS: { value: ExportLayout; label: string; help: string }[] = [
  {
    value: 'wide',
    label: 'Wide — one row per video',
    help: 'Zones, crossing rules and pairs become columns, matched by name across videos.'
  },
  {
    value: 'long',
    label: 'Long — one row per video and zone',
    help: 'The original shape: one row per video × zone (or × rule, × pair).'
  }
]

export interface ExportDialogProps {
  open: boolean
  onClose: () => void
  /** Videos to export. The dialog is a no-op if this is empty when Export is clicked. */
  videoIds: string[]
  /**
   * Where the native save dialog should default to for a given format — callers already know
   * this (next to the video, named after the folder, `"batch-results"`, …).
   */
  getDefaultPath: (format: ExportFormat) => string
}

/**
 * The shared export flow: format + layout (§9) → native save dialog → `POST /api/export` → the
 * usual success notification with "Show in folder". Used by Results, the Library selection bar
 * and Batch's Finish step "Export all" button.
 */
export function ExportDialog({
  open,
  onClose,
  videoIds,
  getDefaultPath
}: ExportDialogProps): React.JSX.Element {
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const exportVideos = useExportVideos()

  const [format, setFormat] = useState<ExportFormat>('xlsx')
  // `null` until the user picks one explicitly — defaults from settings, which may still be
  // loading when the dialog first opens.
  const [layoutChoice, setLayoutChoice] = useState<ExportLayout | null>(null)
  const layout = layoutChoice ?? settings.data?.export_layout ?? 'wide'

  const disabled = videoIds.length === 0 || exportVideos.isPending

  const handleClose = (): void => {
    if (exportVideos.isPending) return
    onClose()
  }

  const handleExport = async (): Promise<void> => {
    if (videoIds.length === 0) return
    const extension = format === 'xlsx' ? 'xlsx' : 'csv'
    const path = await window.tramus.dialog.saveFile({
      defaultPath: getDefaultPath(format),
      filters:
        format === 'xlsx'
          ? [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
          : [{ name: 'CSV', extensions: [extension] }]
    })
    if (!path) return

    updateSettings.mutate({ export_layout: layout })
    exportVideos.mutate(
      { videoIds, format, path, layout },
      {
        onSuccess: (response) => {
          const file = response.files[0]
          notify({
            severity: 'success',
            title: 'Export complete',
            message: response.files.join(', '),
            action: file
              ? {
                  label: 'Show in folder',
                  onClick: () => void window.tramus.shell.showItemInFolder(file)
                }
              : undefined
          })
          onClose()
        },
        onError: (error) => notifyError('Export failed', error)
      }
    )
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Typography variant="h5" component="span">
          Export
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {videoIds.length} {videoIds.length === 1 ? 'video' : 'videos'}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0 }}>
        <OptionGroup title="Format">
          {FORMAT_OPTIONS.map((option) => (
            <OptionRow
              key={option.value}
              label={option.label}
              help={option.help}
              selected={format === option.value}
              onClick={() => setFormat(option.value)}
            />
          ))}
        </OptionGroup>
        <OptionGroup title="Layout">
          {LAYOUT_OPTIONS.map((option) => (
            <OptionRow
              key={option.value}
              label={option.label}
              help={option.help}
              selected={layout === option.value}
              onClick={() => setLayoutChoice(option.value)}
            />
          ))}
        </OptionGroup>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={disabled}
          onClick={() => void handleExport()}
          startIcon={<Symbol name="download" size={16} />}
        >
          Export
        </Button>
      </DialogActions>
    </Dialog>
  )
}

interface OptionGroupProps {
  title: string
  children: React.ReactNode
}

function OptionGroup({ title, children }: OptionGroupProps): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography variant="overline" color="text.disabled">
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>{children}</Box>
    </Box>
  )
}

interface OptionRowProps {
  label: string
  help: string
  selected: boolean
  onClick: () => void
}

function OptionRow({ label, help, selected, onClick }: OptionRowProps): React.JSX.Element {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'grid',
        gridTemplateColumns: '18px minmax(0, 1fr)',
        gap: 1.25,
        alignItems: 'center',
        p: 1,
        borderRadius: '8px',
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: (theme) => (selected ? alpha(theme.palette.primary.main, 0.13) : 'transparent'),
        cursor: 'pointer'
      }}
    >
      <Radio checked={selected} size="small" sx={{ p: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500, fontSize: 13.5 }}>{label}</Typography>
        <Typography variant="caption" color="text.disabled" sx={{ textWrap: 'pretty' }}>
          {help}
        </Typography>
      </Box>
    </Box>
  )
}
