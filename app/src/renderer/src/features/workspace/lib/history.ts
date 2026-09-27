import type { HistoryEntry } from '../../../api/types'

/** Material Symbols icon per `HistoryKind` (`docs/architecture.md` §5.6). */
export function historyIcon(kind: HistoryEntry['kind']): string {
  switch (kind) {
    case 'tracked':
      return 'play_circle'
    case 'set_position':
      return 'my_location'
    case 'mark_hidden':
      return 'visibility_off'
    case 'interpolate':
      return 'linear_scale'
    case 'accept_flag':
      return 'check'
    case 'setup_changed':
      return 'edit'
  }
}
