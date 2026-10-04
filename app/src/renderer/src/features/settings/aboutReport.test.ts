import { describe, expect, it } from 'vitest'

import { formatAboutReport } from './aboutReport'

describe('formatAboutReport', () => {
  it('lists a release build', () => {
    const report = formatAboutReport({
      build: {
        version: '1.2.3',
        buildNumber: 45,
        commit: 'abc1234',
        dirty: false,
        buildDate: '2026-10-04T10:00:00.000Z'
      },
      engineVersion: '1.2.3',
      platform: 'Windows-11'
    })
    expect(report).toBe(
      [
        'Tramus 1.2.3 (build 45)',
        'Commit: abc1234',
        'Built: 2026-10-04T10:00:00.000Z',
        'Engine: 1.2.3',
        'System: Windows-11'
      ].join('\n')
    )
  })

  it('flags uncommitted changes and copes with missing build info', () => {
    const dirty = formatAboutReport({
      build: {
        version: '0.0.0-dev+abc1234.dirty',
        buildNumber: null,
        commit: 'abc1234',
        dirty: true,
        buildDate: null
      },
      engineVersion: '0.0.0-dev',
      platform: 'Linux'
    })
    expect(dirty).toContain('Tramus 0.0.0-dev+abc1234.dirty\n')
    expect(dirty).toContain('Commit: abc1234 (uncommitted changes)')
    expect(dirty).toContain('Built: -')
  })
})
