import { formatFullVersion, type BuildInfo } from '@shared/buildInfo'

export interface AboutReportInput {
  build: BuildInfo
  engineVersion: string
  /** The OS as the engine reports it, e.g. "macOS-14.5-arm64-arm-64bit". */
  platform: string
}

/** The build details as plain text, for pasting into a bug report. */
export function formatAboutReport({ build, engineVersion, platform }: AboutReportInput): string {
  const commit = build.commit
    ? `${build.commit}${build.dirty ? ' (uncommitted changes)' : ''}`
    : '-'
  return [
    `Tramus ${formatFullVersion(build)}`,
    `Commit: ${commit}`,
    `Built: ${build.buildDate ?? '-'}`,
    `Engine: ${engineVersion}`,
    `System: ${platform}`
  ].join('\n')
}
