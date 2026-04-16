import { describe, expect, it } from 'vitest'

import { buildFrontmatter } from '../frontmatter'

describe('buildFrontmatter', () => {
  it('escapes embedded double quotes and backslashes in strings', () => {
    const yaml = buildFrontmatter({ name: 'a "quoted" \\ slash' })
    expect(yaml).toContain('name: "a \\"quoted\\" \\\\ slash"')
  })

  it('skips null and undefined fields', () => {
    const yaml = buildFrontmatter({
      type: 'chapter',
      parent: null,
      synopsis: undefined,
      title: 'Ch 1'
    })
    expect(yaml).not.toMatch(/parent:/)
    expect(yaml).not.toMatch(/synopsis:/)
    expect(yaml).toContain('type: "chapter"')
    expect(yaml).toContain('title: "Ch 1"')
  })

  it('renders string arrays in flow format with quotes and spacing', () => {
    const yaml = buildFrontmatter({ aliases: ['El', 'Scholar'] })
    expect(yaml).toContain('aliases: [ "El", "Scholar" ]')
  })

  it('renders number arrays in flow format without spaces', () => {
    const yaml = buildFrontmatter({ appearances: [1, 2, 3] })
    expect(yaml).toContain('appearances: [1, 2, 3]')
  })

  it('produces just the fences when given an empty object', () => {
    expect(buildFrontmatter({})).toBe('---\n---\n\n')
  })

  it('renders booleans without quotes', () => {
    const yaml = buildFrontmatter({ ready: true, dirty: false })
    expect(yaml).toContain('ready: true')
    expect(yaml).toContain('dirty: false')
  })
})
