import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'

import { useDeleteTemplate, useTemplates, useUpdateTemplate } from '../../api/queries'
import type { Template } from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { ShortcutTooltip } from '../../components/ShortcutTooltip'
import { Symbol } from '../../components/Symbol'
import { notify, notifyError } from '../../stores/notifications'
import { RenameTemplateDialog } from './RenameTemplateDialog'
import { TemplatePreview } from './TemplatePreview'
import { formatTemplateMeta, formatTemplateSaved } from './templateFormat'

/**
 * The Templates screen: every saved arena/zone template, with rename and delete. Templates are
 * created from a video's Setup step ("Save as template"), never here — see the empty state.
 */
export function TemplatesScreen(): React.JSX.Element {
  const { data: templates, isLoading, isError, error } = useTemplates()
  const [renaming, setRenaming] = useState<Template | null>(null)
  const [deleting, setDeleting] = useState<Template | null>(null)
  const updateTemplate = useUpdateTemplate()
  const deleteTemplate = useDeleteTemplate()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          height: 60,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          flex: 'none'
        }}
      >
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>Templates</Typography>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, p: 2 }}>
        {isLoading ? (
          <Typography color="text.disabled" sx={{ p: 2 }}>
            Loading…
          </Typography>
        ) : isError ? (
          <EmptyState
            icon="error"
            title="Couldn't load templates"
            description={error instanceof Error ? error.message : undefined}
          />
        ) : !templates || templates.length === 0 ? (
          <EmptyState
            icon="bookmarks"
            title="No templates yet"
            description={
              <>
                Templates save a video's arena, zones and detection settings for reuse. Open a
                video, set it up, then use <strong>Save as template</strong> in Setup.
              </>
            }
          />
        ) : (
          <Box
            sx={{ maxWidth: 760, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 1.25 }}
          >
            {templates.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                onRename={() => setRenaming(template)}
                onDelete={() => setDeleting(template)}
              />
            ))}
          </Box>
        )}
      </Box>

      <RenameTemplateDialog
        key={renaming?.id ?? 'closed'}
        open={renaming !== null}
        initialName={renaming?.name ?? ''}
        submitting={updateTemplate.isPending}
        onCancel={() => setRenaming(null)}
        onSubmit={(name) => {
          if (!renaming) return
          updateTemplate.mutate(
            { ...renaming, name },
            {
              onSuccess: () => {
                setRenaming(null)
                notify({ severity: 'success', title: 'Template renamed' })
              },
              onError: (err) => notifyError('Could not rename the template', err)
            }
          )
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete template?"
        description={
          deleting ? `"${deleting.name}" will be deleted. This can't be undone.` : undefined
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          const template = deleting
          deleteTemplate.mutate(template.id, {
            onSuccess: () => {
              setDeleting(null)
              notify({ severity: 'success', title: `Deleted "${template.name}"` })
            },
            onError: (err) => notifyError('Could not delete the template', err)
          })
        }}
      />
    </Box>
  )
}

interface TemplateRowProps {
  template: Template
  onRename: () => void
  onDelete: () => void
}

function TemplateRow({ template, onRename, onDelete }: TemplateRowProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '76px minmax(0, 1fr) auto',
        gap: 1.5,
        alignItems: 'center',
        p: 1.25,
        borderRadius: '10px',
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}
    >
      <Box
        sx={{
          width: 76,
          height: 65,
          borderRadius: '5px',
          overflow: 'hidden',
          bgcolor: 'canvas',
          flexShrink: 0
        }}
      >
        <TemplatePreview template={template} />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 0.25 }}>
        <Typography sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }} noWrap>
          {template.name}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {formatTemplateMeta(template)}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {formatTemplateSaved(template)}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <ShortcutTooltip title="Rename">
          <IconButton onClick={onRename}>
            <Symbol name="edit" size={18} />
          </IconButton>
        </ShortcutTooltip>
        <ShortcutTooltip title="Delete">
          <IconButton onClick={onDelete}>
            <Symbol name="delete" size={18} />
          </IconButton>
        </ShortcutTooltip>
      </Box>
    </Box>
  )
}
