import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useNavigate } from 'react-router'

import { Symbol } from '../../../components/Symbol'

export interface BreadcrumbProps {
  /** Absolute path to the video file. */
  videoPath: string
  fileName: string
}

function dirname(fullPath: string): string {
  const index = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'))
  return index === -1 ? '' : fullPath.slice(0, index)
}

/** The last one or two path segments, for a compact breadcrumb label. */
function folderLabel(dir: string): string {
  const separator = dir.includes('\\') && !dir.includes('/') ? '\\' : '/'
  const parts = dir.split(separator).filter(Boolean)
  return parts.slice(-2).join('/') || dir
}

/** Folder › file name, the folder linking back to that folder in the Library. */
export function Breadcrumb({ videoPath, fileName }: BreadcrumbProps): React.JSX.Element {
  const navigate = useNavigate()
  const dir = dirname(videoPath)

  return (
    <Box
      sx={{
        flex: '1 1 0',
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5
      }}
    >
      <Symbol name="folder" size={17} sx={{ color: 'text.disabled', flexShrink: 0 }} />
      <Typography
        component="a"
        title="Back to Library"
        onClick={() => void navigate(`/library?folder=${encodeURIComponent(dir)}`)}
        sx={{
          color: 'text.secondary',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
          cursor: 'pointer',
          fontSize: 13,
          '&:hover': { color: 'text.primary' }
        }}
      >
        {folderLabel(dir)}
      </Typography>
      <Symbol name="chevron_right" size={16} sx={{ color: 'text.disabled', flexShrink: 0 }} />
      <Typography
        sx={{
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0,
          fontSize: 13
        }}
      >
        {fileName}
      </Typography>
    </Box>
  )
}
