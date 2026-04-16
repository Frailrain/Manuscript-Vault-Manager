import { describe, expect, it } from 'vitest'

import {
  buildNameResolver,
  chapterWikiLink,
  renderEntityLink
} from '../wikilinks'

describe('buildNameResolver', () => {
  it('matches by canonical name case-insensitively', () => {
    const resolver = buildNameResolver([
      { name: 'Elara', aliases: [] },
      { name: 'Captain Vorn', aliases: [] }
    ])
    expect(resolver.resolve('elara')).toBe('Elara')
    expect(resolver.resolve('  ELARA  ')).toBe('Elara')
  })

  it('matches by alias', () => {
    const resolver = buildNameResolver([
      { name: 'Elara', aliases: ['El', 'The Scholar'] }
    ])
    expect(resolver.resolve('the scholar')).toBe('Elara')
    expect(resolver.resolve('El')).toBe('Elara')
  })

  it('returns undefined for unknown names', () => {
    const resolver = buildNameResolver([{ name: 'Elara', aliases: [] }])
    expect(resolver.resolve('Nobody')).toBeUndefined()
  })
})

describe('renderEntityLink', () => {
  it('renders resolved names as wiki-links via the filename mapper', () => {
    const resolver = buildNameResolver([
      { name: 'Captain Vorn', aliases: ['Vorn'] }
    ])
    const warnings: string[] = []
    const link = renderEntityLink(
      'Vorn',
      resolver,
      (canonical) => (canonical === 'Captain Vorn' ? 'Captain Vorn' : canonical),
      'test context',
      warnings
    )
    expect(link).toBe('[[Captain Vorn]]')
    expect(warnings).toHaveLength(0)
  })

  it('falls back to plain text and warns for unresolved references', () => {
    const resolver = buildNameResolver([{ name: 'Elara', aliases: [] }])
    const warnings: string[] = []
    const link = renderEntityLink(
      'Mystery Guest',
      resolver,
      () => 'ignored',
      'dashboard characters',
      warnings
    )
    expect(link).toBe('Mystery Guest')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('Mystery Guest')
    expect(warnings[0]).toContain('dashboard characters')
  })
})

describe('chapterWikiLink', () => {
  it('looks up the canonical filename by chapter order', () => {
    const map = new Map<number, string>([
      [1, '01 - The Academy'],
      [3, '03 - The Silver Tower']
    ])
    expect(chapterWikiLink(3, map)).toBe('[[03 - The Silver Tower]]')
  })

  it('falls back to plain text when the order is missing', () => {
    const map = new Map<number, string>()
    expect(chapterWikiLink(7, map)).toBe('Chapter 7')
  })
})
