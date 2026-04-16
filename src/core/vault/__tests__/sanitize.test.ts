import { describe, expect, it } from 'vitest'

import { stripHeadingMarkers } from '../sanitize'

describe('stripHeadingMarkers', () => {
  it('removes leading ## markers from section-level headings', () => {
    const input = 'Intro sentence.\n## Rogue Heading\nMore prose.\n'
    const stripped = stripHeadingMarkers(input)
    expect(stripped).toBe('Intro sentence.\nRogue Heading\nMore prose.\n')
  })

  it('removes leading ### and deeper markers too', () => {
    expect(stripHeadingMarkers('### Deeper\n#### Deepest')).toBe(
      'Deeper\nDeepest'
    )
  })

  it('leaves lines without a leading heading marker untouched', () => {
    const input =
      'A paragraph mentioning ## inside prose is left alone.\n- A bullet.\n'
    expect(stripHeadingMarkers(input)).toBe(input)
  })

  it('does not touch single-hash H1 lines', () => {
    expect(stripHeadingMarkers('# Title\nBody')).toBe('# Title\nBody')
  })
})
