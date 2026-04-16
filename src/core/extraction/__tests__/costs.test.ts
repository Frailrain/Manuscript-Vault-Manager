import { describe, expect, it } from 'vitest'

import { estimateCost, hasKnownPricing, MODEL_PRICING } from '../costs'

describe('costs', () => {
  it('estimates cost for a known model using its input/output rates', () => {
    const model = 'claude-haiku-4-5-20251001'
    expect(hasKnownPricing(model)).toBe(true)

    const pricing = MODEL_PRICING[model]!
    const input = 1_000_000
    const output = 200_000
    const expected =
      (input / 1_000_000) * pricing.input + (output / 1_000_000) * pricing.output
    expect(estimateCost(model, input, output)).toBeCloseTo(expected, 8)
  })

  it('returns zero cost for an unknown model and reports hasKnownPricing=false', () => {
    const model = 'not-a-real-model-2026'
    expect(hasKnownPricing(model)).toBe(false)
    expect(estimateCost(model, 100_000, 50_000)).toBe(0)
  })
})
