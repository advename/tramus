import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'

import { useTemplates } from '../../../api/queries'

export interface LoadTemplateMenuProps {
  anchorEl: HTMLElement | null
  onClose: () => void
  onSelect: (templateId: string) => void
}

/** "Load template…" — lists the user's saved templates. */
export function LoadTemplateMenu({
  anchorEl,
  onClose,
  onSelect
}: LoadTemplateMenuProps): React.JSX.Element {
  const templates = useTemplates()

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      {templates.data && templates.data.length > 0 ? (
        templates.data.map((template) => (
          <MenuItem
            key={template.id}
            onClick={() => {
              onSelect(template.id)
              onClose()
            }}
          >
            {template.name}
          </MenuItem>
        ))
      ) : (
        <MenuItem disabled>
          <Typography sx={{ fontSize: 12.5, color: 'text.disabled' }}>
            {templates.isLoading ? 'Loading…' : 'No templates yet'}
          </Typography>
        </MenuItem>
      )}
    </Menu>
  )
}
