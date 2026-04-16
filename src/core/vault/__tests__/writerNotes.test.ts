import { describe, expect, it } from 'vitest'

import { extractWriterNotes, injectWriterNotes } from '../writerNotes'

describe('extractWriterNotes', () => {
  it('returns the notes body when the heading is present', () => {
    const content = [
      '# Title',
      '',
      "## Writer's Notes",
      '',
      'This scene reminds me of a dream I had.',
      ''
    ].join('\n')
    expect(extractWriterNotes(content)).toBe(
      '\nThis scene reminds me of a dream I had.\n'
    )
  })

  it('returns an empty string when the heading is missing', () => {
    const content = '# Title\n\nNo writer-managed section here.\n'
    expect(extractWriterNotes(content)).toBe('')
  })

  it('stops at the next ## heading', () => {
    const content = [
      "## Writer's Notes",
      '',
      'Notes body.',
      '',
      '## Appendix',
      '',
      'Ignored.'
    ].join('\n')
    const notes = extractWriterNotes(content)
    expect(notes).toContain('Notes body.')
    expect(notes).not.toContain('Appendix')
    expect(notes).not.toContain('Ignored')
  })
})

describe('injectWriterNotes', () => {
  it('places preserved content after the Writer\'s Notes heading', () => {
    const template = [
      '# Title',
      '',
      "## Writer's Notes",
      ''
    ].join('\n') + '\n'
    const injected = injectWriterNotes(template, 'My preserved notes.\n')
    expect(injected).toContain("## Writer's Notes\nMy preserved notes.")
  })

  it('round-trips: extract then inject reproduces the notes body', () => {
    const original = [
      '# Title',
      '',
      "## Writer's Notes",
      '',
      'Multi-line',
      'notes with detail.',
      ''
    ].join('\n')
    const notes = extractWriterNotes(original)
    const template = [
      '# Title',
      '',
      "## Writer's Notes",
      ''
    ].join('\n') + '\n'
    const rebuilt = injectWriterNotes(template, notes)
    expect(extractWriterNotes(rebuilt).trim()).toBe(notes.trim())
  })
})
