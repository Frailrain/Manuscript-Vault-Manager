import { describe, expect, it } from 'vitest'

import { findPreset, type GlossaryEntry } from '../../../../shared/presets'
import { renderGlossaryBlock } from '../common'

describe('renderGlossaryBlock', () => {
  it('returns an empty string when the glossary is empty', () => {
    expect(renderGlossaryBlock([])).toBe('')
  })

  it('renders each entry as a bold-term bullet with trailing blank line', () => {
    const glossary: GlossaryEntry[] = [
      { term: 'mob', meaning: 'A monster enemy.' },
      { term: 'tank', meaning: 'A frontline damage-absorber.' }
    ]
    const block = renderGlossaryBlock(glossary)
    expect(block).toContain('Genre vocabulary')
    expect(block).toContain('- **mob**: A monster enemy.')
    expect(block).toContain('- **tank**: A frontline damage-absorber.')
    expect(block.endsWith('\n\n')).toBe(true)
  })

  it('includes every term from the LitRPG preset glossary in the rendered block', () => {
    const litrpg = findPreset('litrpg')!
    const block = renderGlossaryBlock(litrpg.glossary)
    for (const entry of litrpg.glossary) {
      expect(block).toContain(`**${entry.term}**`)
    }
  })

  it('produces no leading text before the heading when called with non-empty glossary', () => {
    const block = renderGlossaryBlock([
      { term: 'bond', meaning: 'A magical connection.' }
    ])
    expect(block.startsWith('Genre vocabulary')).toBe(true)
  })
})
