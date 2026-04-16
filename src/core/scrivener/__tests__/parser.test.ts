import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { parseScrivenerProject } from '../parser'
import { ScrivenerParseError } from '../errors'

const here = dirname(fileURLToPath(import.meta.url))
const minimalRoot = join(here, 'fixtures', 'minimal.scriv')
const hierarchicalRoot = join(here, 'fixtures', 'hierarchical.scriv')

const SHA256_HEX = /^[0-9a-f]{64}$/

describe('parseScrivenerProject', () => {
  it('parses a minimal project into two chapters each with one scene', async () => {
    const project = await parseScrivenerProject(minimalRoot)

    expect(project.projectName).toBe('minimal')
    expect(project.chapters).toHaveLength(2)

    const [first, second] = project.chapters
    expect(first!.title).toBe('Opening')
    expect(first!.scenes).toHaveLength(1)
    expect(first!.scenes[0]!.content).toBe('Hello world.')
    expect(first!.scenes[0]!.contentHash).toMatch(SHA256_HEX)
    expect(first!.scenes[0]!.wordCount).toBe(2)

    expect(second!.title).toBe('Second Scene')
    expect(second!.scenes[0]!.content).toBe(
      'The quick brown fox.\n\nJumps over the lazy dog.'
    )
    expect(second!.scenes[0]!.contentHash).toMatch(SHA256_HEX)
    expect(second!.scenes[0]!.wordCount).toBe(9)
  })

  it('parses a hierarchical project with Part > Chapter > Scenes, excluding IncludeInCompile="No" scenes and ignoring Research/Trash', async () => {
    const project = await parseScrivenerProject(hierarchicalRoot)

    expect(project.chapters).toHaveLength(2)

    const first = project.chapters[0]!
    expect(first.title).toBe('Chapter 1')
    expect(first.parentTitle).toBe('Part One')
    expect(first.label).toBe('Draft')
    expect(first.status).toBe('First Draft')
    expect(first.scenes).toHaveLength(2)
    expect(first.scenes.map((s) => s.title)).toEqual(['Scene 1', 'Scene 3'])

    const scene1 = first.scenes[0]!
    expect(scene1.content).toContain('Café')
    expect(scene1.content).toContain('—')
    expect(scene1.content).toContain('The wind howled outside.')

    const second = project.chapters[1]!
    expect(second.title).toBe('Chapter 2')
    expect(second.parentTitle).toBe('Part One')
    expect(second.scenes).toHaveLength(1)
    expect(second.scenes[0]!.title).toBe('Opening')

    const allUuids = [
      ...project.chapters.map((c) => c.uuid),
      ...project.chapters.flatMap((c) => c.scenes.map((s) => s.uuid))
    ]
    expect(allUuids).not.toContain('DEADBEEF-DEAD-BEEF-DEAD-BEEFDEADBEEF')
    expect(allUuids).not.toContain('33333333-3333-3333-3333-333333333322')
  })

  it('throws ScrivenerParseError with "not found" when the path does not exist', async () => {
    await expect(
      parseScrivenerProject('/definitely/does/not/exist.scriv')
    ).rejects.toMatchObject({
      name: 'ScrivenerParseError',
      message: expect.stringContaining('not found')
    })
    await expect(
      parseScrivenerProject('/definitely/does/not/exist.scriv')
    ).rejects.toBeInstanceOf(ScrivenerParseError)
  })

  it('accepts a direct path to the .scrivx file and resolves the project correctly', async () => {
    const viaScrivx = join(minimalRoot, 'minimal.scrivx')
    const project = await parseScrivenerProject(viaScrivx)

    expect(project.projectName).toBe('minimal')
    expect(project.chapters).toHaveLength(2)
  })

  it('produces identical content hashes when parsing the same project twice', async () => {
    const a = await parseScrivenerProject(minimalRoot)
    const b = await parseScrivenerProject(minimalRoot)

    const hashesA = a.chapters.flatMap((c) => c.scenes.map((s) => s.contentHash))
    const hashesB = b.chapters.flatMap((c) => c.scenes.map((s) => s.contentHash))
    expect(hashesA).toEqual(hashesB)
    expect(hashesA.every((h) => SHA256_HEX.test(h))).toBe(true)
  })
})
