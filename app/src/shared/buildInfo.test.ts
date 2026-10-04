import { describe, expect, it } from 'vitest'

import { formatFullVersion, parseBuildInfo } from './buildInfo'

describe('formatFullVersion', () => {
  it('adds the build number to a release version', () => {
    expect(formatFullVersion({ version: '1.2.3', buildNumber: 45 })).toBe('1.2.3 (build 45)')
  })

  it('leaves a local build version as it is', () => {
    expect(formatFullVersion({ version: '0.0.0-dev+abc1234.dirty', buildNumber: null })).toBe(
      '0.0.0-dev+abc1234.dirty'
    )
  })
})

describe('parseBuildInfo', () => {
  const valid = {
    version: '1.2.3',
    buildNumber: 45,
    commit: 'abc1234',
    dirty: false,
    buildDate: '2026-10-04T10:00:00.000Z'
  }

  it('accepts the generated file', () => {
    expect(parseBuildInfo(valid)).toEqual(valid)
    expect(parseBuildInfo({ ...valid, buildNumber: null, commit: null })).not.toBeNull()
  })

  it('rejects anything else', () => {
    expect(parseBuildInfo(null)).toBeNull()
    expect(parseBuildInfo('1.2.3')).toBeNull()
    expect(parseBuildInfo({ ...valid, version: '' })).toBeNull()
    expect(parseBuildInfo({ ...valid, buildNumber: '45' })).toBeNull()
    expect(parseBuildInfo({ ...valid, dirty: undefined })).toBeNull()
  })
})
