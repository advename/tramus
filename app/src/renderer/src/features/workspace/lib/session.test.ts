import { describe, expect, it } from 'vitest'

import { trialSummaryText } from './session'

describe('trialSummaryText', () => {
  it('omits the excluded segment when nothing was excluded', () => {
    expect(
      trialSummaryText({ trial_duration_s: 300, excluded_duration_s: 0, analysed_duration_s: 300 })
    ).toBe('Trial 5:00.000 · 5:00.000 analysed')
  })

  it('includes the excluded segment when some time was excluded', () => {
    expect(
      trialSummaryText({
        trial_duration_s: 300,
        excluded_duration_s: 12,
        analysed_duration_s: 288
      })
    ).toBe('Trial 5:00.000 · 0:12.000 excluded · 4:48.000 analysed')
  })
})
