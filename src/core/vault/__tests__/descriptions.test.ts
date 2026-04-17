import { describe, expect, it } from 'vitest'

import {
  parseChapterTaggedDescription,
  synthesizeDescription
} from '../descriptions'

describe('parseChapterTaggedDescription', () => {
  it('returns empty array for untagged input', () => {
    const blocks = parseChapterTaggedDescription(
      'Just a plain description with no chapter prefix.'
    )
    expect(blocks).toEqual([])
  })

  it('parses a single (Ch N): block', () => {
    const blocks = parseChapterTaggedDescription(
      '(Ch 1): Tall, grey-eyed scholar.'
    )
    expect(blocks).toEqual([
      { chapterOrder: 1, text: 'Tall, grey-eyed scholar.' }
    ])
  })

  it('parses multiple blocks with correct chapter orders and bodies', () => {
    const blocks = parseChapterTaggedDescription(
      '(Ch 1): Tall, grey-eyed scholar with a scar across her cheek.\n\n(Ch 3): Carries a silver knife engraved with an unknown crest.'
    )
    expect(blocks).toEqual([
      {
        chapterOrder: 1,
        text: 'Tall, grey-eyed scholar with a scar across her cheek.'
      },
      {
        chapterOrder: 3,
        text: 'Carries a silver knife engraved with an unknown crest.'
      }
    ])
  })
})

describe('synthesizeDescription', () => {
  it('returns the input unchanged when not chapter-tagged', () => {
    const out = synthesizeDescription('A grizzled veteran of the Border Wars.')
    expect(out).toBe('A grizzled veteran of the Border Wars.')
  })

  it('returns the single block text for one-chapter descriptions', () => {
    const out = synthesizeDescription('(Ch 1): Tall and grey-eyed.')
    expect(out).toBe('Tall and grey-eyed.')
  })

  it('joins two blocks with the default ", who " connective and lowercases the continuation', () => {
    const out = synthesizeDescription(
      '(Ch 1): Tall, grey-eyed scholar with a scar across her cheek.\n\n(Ch 3): Carries a silver knife engraved with an unknown crest.'
    )
    expect(out).toBe(
      'Tall, grey-eyed scholar with a scar across her cheek, who carries a silver knife engraved with an unknown crest.'
    )
  })

  it('joins three or more blocks into one paragraph', () => {
    const out = synthesizeDescription(
      '(Ch 1): Tall scholar.\n\n(Ch 2): Carries a silver knife.\n\n(Ch 3): Wears a blue cloak.'
    )
    expect(out).toBe(
      'Tall scholar, who carries a silver knife, who wears a blue cloak.'
    )
  })

  it('falls back to the first block when synthesis exceeds 400 characters', () => {
    const long = 'x'.repeat(250)
    const input = `(Ch 1): ${long}.\n\n(Ch 2): ${long}.`
    const out = synthesizeDescription(input)
    expect(out).toBe(`${long}.`)
  })

  it('uses a custom connective when provided', () => {
    const out = synthesizeDescription(
      '(Ch 3): An obsidian spire.\n\n(Ch 7): Carved with silver glyphs.',
      '. It '
    )
    expect(out).toBe('An obsidian spire. It carved with silver glyphs.')
  })

  it('parsed blocks are not identifiable as part of the synthesized paragraph', () => {
    const input =
      '(Ch 1): First detail.\n\n(Ch 2): Second detail.'
    const synth = synthesizeDescription(input)
    expect(synth).not.toContain('(Ch 1):')
    expect(synth).not.toContain('(Ch 2):')
  })
})
