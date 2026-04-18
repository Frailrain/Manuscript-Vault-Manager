import { describe, expect, it } from 'vitest'

import { escapeMarkdownInline, sanitizeLLMText } from '../sanitize'

describe('escapeMarkdownInline', () => {
  it('passes plain text through unchanged', () => {
    expect(escapeMarkdownInline('hello world')).toBe('hello world')
  })

  it('passes the empty string through unchanged', () => {
    expect(escapeMarkdownInline('')).toBe('')
  })

  it('escapes angle brackets around a LitRPG-style title', () => {
    expect(escapeMarkdownInline('uses <System Command>')).toBe(
      'uses \\<System Command\\>'
    )
  })

  it('escapes single square brackets', () => {
    expect(escapeMarkdownInline('press [Enter] to continue')).toBe(
      'press \\[Enter\\] to continue'
    )
  })

  it('preserves a wiki-link', () => {
    expect(escapeMarkdownInline('visits [[Silver Tower]]')).toBe(
      'visits [[Silver Tower]]'
    )
  })

  it('preserves a wiki-link while escaping adjacent single brackets', () => {
    expect(escapeMarkdownInline('[[Elara]] uses [Basic Command]')).toBe(
      '[[Elara]] uses \\[Basic Command\\]'
    )
  })

  it('escapes backticks', () => {
    expect(escapeMarkdownInline('press `tab` for')).toBe(
      'press \\`tab\\` for'
    )
  })

  it('escapes a backslash first so nothing gets double-escaped', () => {
    expect(escapeMarkdownInline('a \\ b')).toBe('a \\\\ b')
  })

  it('preserves multiple wiki-links on the same line', () => {
    expect(escapeMarkdownInline('[[A]] and [[B]] meet')).toBe(
      '[[A]] and [[B]] meet'
    )
  })

  it('keeps wiki-link intact next to an escape target', () => {
    expect(escapeMarkdownInline('[[A]] <title>')).toBe(
      '[[A]] \\<title\\>'
    )
  })

  it('escapes the confirmed LitRPG bug case end-to-end', () => {
    const input =
      'Leah checks her new <Ambassador Of A New Age> title and reminisces.'
    expect(escapeMarkdownInline(input)).toBe(
      'Leah checks her new \\<Ambassador Of A New Age\\> title and reminisces.'
    )
  })

  it('leaves bold and italic markers alone (writer intent)', () => {
    expect(escapeMarkdownInline('she was *furious* and **loud**')).toBe(
      'she was *furious* and **loud**'
    )
  })
})

describe('sanitizeLLMText', () => {
  it('strips a leading heading marker and then escapes', () => {
    expect(sanitizeLLMText('## <Title> of the chapter')).toBe(
      '\\<Title\\> of the chapter'
    )
  })

  it('sanitizes multiline text preserving newlines', () => {
    const input = 'line one <tag>\n## line two [x]'
    expect(sanitizeLLMText(input)).toBe(
      'line one \\<tag\\>\nline two \\[x\\]'
    )
  })
})
