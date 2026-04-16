import { describe, expect, it } from 'vitest'

import { rtfToPlainText } from '../rtf'

describe('rtfToPlainText', () => {
  it('strips a minimal RTF wrapper and emits a plain paragraph', () => {
    const out = rtfToPlainText('{\\rtf1\\ansi Hello world\\par}')
    expect(out).toBe('Hello world')
  })

  it('strips bold and italic formatting while preserving the text', () => {
    const input =
      '{\\rtf1\\ansi\\ansicpg1252' +
      '{\\fonttbl\\f0\\fswiss Helvetica;}' +
      '\\pard The \\b quick\\b0  \\i brown\\i0  fox.\\par\n' +
      'Jumps.\\par}'
    const out = rtfToPlainText(input)
    expect(out).toBe('The quick brown fox.\n\nJumps.')
  })

  it("decodes \\'XX hex escapes through the declared codepage", () => {
    const out = rtfToPlainText("{\\rtf1\\ansi\\ansicpg1252 Caf\\'e9}")
    expect(out).toBe('Café')
  })

  it('decodes \\uNNNN unicode escapes and skips the single-char fallback', () => {
    const out = rtfToPlainText('{\\rtf1\\ansi Caf\\u233?}')
    expect(out).toBe('Café')
  })

  it('skips nested ignorable destinations and keeps surrounding text', () => {
    const out = rtfToPlainText('{\\*\\fonttbl{\\f0 Times;}}Hello')
    expect(out).toBe('Hello')
  })
})
