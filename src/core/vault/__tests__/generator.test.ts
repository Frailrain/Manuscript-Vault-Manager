import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { generateVault } from '../generator'
import type {
  ExtractionResult,
  ScrivenerProject
} from '../../../shared/types'
import {
  buildMiniExtraction,
  buildMiniScrivenerProject
} from './fixtures/mini-extraction'

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw err
  }
}

describe('generateVault', () => {
  let vaultPath: string
  let extraction: ExtractionResult
  let project: ScrivenerProject

  beforeEach(async () => {
    vaultPath = await mkdtemp(join(tmpdir(), 'mvm-vault-test-'))
    extraction = buildMiniExtraction()
    project = buildMiniScrivenerProject()
  })

  afterEach(async () => {
    await rm(vaultPath, { recursive: true, force: true })
  })

  it('creates every expected directory', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    for (const dir of [
      'Chapters',
      'Characters',
      'Locations',
      'Timeline',
      'Continuity',
      '_meta'
    ]) {
      expect(await pathExists(join(vaultPath, dir))).toBe(true)
    }
    expect(await pathExists(join(vaultPath, 'Dashboard.md'))).toBe(true)
  })

  it('writes chapter files with correct filename, frontmatter, and wiki-links', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const chapterPath = join(vaultPath, 'Chapters', '03 - The Silver Tower.md')
    const content = await readFile(chapterPath, 'utf8')
    expect(content).toMatch(/^---\n/)
    expect(content).toContain('type: "chapter"')
    expect(content).toContain('order: 3')
    expect(content).toContain('title: "The Silver Tower"')
    expect(content).toContain('scrivenerUuid: "uuid-chapter-3"')
    expect(content).toContain('# Chapter 3: The Silver Tower')
    expect(content).toContain('[[Elara]]')
    expect(content).toContain('[[The Archivist]]')
    expect(content).toContain('[[The Silver Tower]]')
    expect(content).toContain("## Writer's Notes")
    expect(content).toContain('<!-- MVM:MANAGED:start -->')
  })

  it('omits parent/synopsis when they are null', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const ch2 = await readFile(
      join(vaultPath, 'Chapters', '02 - Redgate.md'),
      'utf8'
    )
    expect(ch2).not.toMatch(/^parent:/m)
    expect(ch2).not.toMatch(/^synopsis:/m)
    const ch1 = await readFile(
      join(vaultPath, 'Chapters', '01 - The Academy.md'),
      'utf8'
    )
    expect(ch1).toContain('parent: "Part One"')
    expect(ch1).toContain('synopsis: "Elara arrives."')
  })

  it('writes character frontmatter with aliases and resolves alias references', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const elara = await readFile(
      join(vaultPath, 'Characters', 'Elara.md'),
      'utf8'
    )
    expect(elara).toContain('aliases: [ "El", "The Scholar" ]')
    expect(elara).toContain('firstAppearance: 1')
    expect(elara).toContain('appearances: [1, 2, 3]')
    expect(elara).toContain('[[Captain Vorn]]')
  })

  it('omits aliases field for characters without any', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const vorn = await readFile(
      join(vaultPath, 'Characters', 'Captain Vorn.md'),
      'utf8'
    )
    expect(vorn).not.toMatch(/^aliases:/m)
  })

  it('renders chapter-tagged descriptions verbatim in the managed block', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const elara = await readFile(
      join(vaultPath, 'Characters', 'Elara.md'),
      'utf8'
    )
    expect(elara).toContain(
      '(Ch 1): Tall, grey-eyed scholar with a scar across her cheek.'
    )
    expect(elara).toContain(
      '(Ch 3): Carries a silver knife engraved with an unknown crest.'
    )
  })

  it("preserves Writer's Notes text on regeneration", async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const elaraPath = join(vaultPath, 'Characters', 'Elara.md')
    const before = await readFile(elaraPath, 'utf8')
    const edited = before.replace(
      "## Writer's Notes\n",
      "## Writer's Notes\n\nI want to make her left-handed.\n"
    )
    await writeFile(elaraPath, edited, 'utf8')
    const result = await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const after = await readFile(elaraPath, 'utf8')
    expect(after).toContain('I want to make her left-handed.')
    expect(result.filesPreserved).toBeGreaterThanOrEqual(1)
  })

  it("treats a missing Writer's Notes heading as empty (no recovery)", async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const elaraPath = join(vaultPath, 'Characters', 'Elara.md')
    const edited = (await readFile(elaraPath, 'utf8'))
      .replace(/## Writer's Notes[\s\S]*$/, '')
      .concat('\nAn orphan paragraph with no heading.\n')
    await writeFile(elaraPath, edited, 'utf8')
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const after = await readFile(elaraPath, 'utf8')
    expect(after).toContain("## Writer's Notes")
    expect(after).not.toContain('An orphan paragraph with no heading.')
  })

  it('clean: true wipes Chapters/ contents but not _meta/ or user-created folders', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const userDir = join(vaultPath, 'MyNotes')
    await mkdir(userDir, { recursive: true })
    await writeFile(join(userDir, 'keep.md'), 'keep me\n', 'utf8')
    const orphanChapter = join(vaultPath, 'Chapters', 'stale.md')
    await writeFile(orphanChapter, 'stale\n', 'utf8')

    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel',
      clean: true
    })

    expect(await pathExists(orphanChapter)).toBe(false)
    expect(await pathExists(join(userDir, 'keep.md'))).toBe(true)
    expect(await pathExists(join(vaultPath, '_meta', 'extraction-log.json'))).toBe(
      true
    )
  })

  it('reports correct filesWritten and filesPreserved counts', async () => {
    const first = await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    // 3 chapters + 3 characters + 2 locations + timeline + continuity + dashboard = 11
    expect(first.filesWritten).toBe(11)
    expect(first.filesPreserved).toBe(0)

    const notesPath = join(vaultPath, 'Characters', 'Elara.md')
    const notesContent = (await readFile(notesPath, 'utf8')).replace(
      "## Writer's Notes\n",
      "## Writer's Notes\n\nKeep me.\n"
    )
    await writeFile(notesPath, notesContent, 'utf8')

    const second = await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    expect(second.filesWritten).toBe(11)
    expect(second.filesPreserved).toBe(1)
  })

  it('writes a valid JSON extraction log', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const logPath = join(vaultPath, '_meta', 'extraction-log.json')
    const raw = await readFile(logPath, 'utf8')
    const parsed = JSON.parse(raw)
    expect(parsed.projectName).toBe('Mini Test Novel')
    expect(parsed.counts.chapters).toBe(3)
    expect(parsed.counts.characters).toBe(3)
    expect(parsed.tokenUsage.inputTokens).toBe(28_400)
  })

  it('groups continuity issues by severity and omits empty sections', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const content = await readFile(
      join(vaultPath, 'Continuity', 'Flagged Issues.md'),
      'utf8'
    )
    expect(content).toContain('## High Severity')
    expect(content).toContain('## Medium Severity')
    expect(content).not.toContain('## Low Severity')
    expect(content).toContain('### Chapter 3: ')
    expect(content).toContain('### Chapter 2: ')
  })

  it('dashboard recent-issues list is capped at 5 and sorted by severity', async () => {
    const manyIssues: ExtractionResult = {
      ...extraction,
      continuityIssues: [
        { severity: 'low', description: 'Low A', chapters: [5], suggestion: '.' },
        { severity: 'high', description: 'High A', chapters: [9], suggestion: '.' },
        { severity: 'medium', description: 'Med A', chapters: [2], suggestion: '.' },
        { severity: 'high', description: 'High B', chapters: [3], suggestion: '.' },
        { severity: 'low', description: 'Low B', chapters: [7], suggestion: '.' },
        { severity: 'medium', description: 'Med B', chapters: [4], suggestion: '.' },
        { severity: 'high', description: 'High C', chapters: [11], suggestion: '.' }
      ]
    }
    await generateVault(manyIssues, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const dash = await readFile(join(vaultPath, 'Dashboard.md'), 'utf8')
    const recent = dash
      .split('## Recent Continuity Issues')[1]!
      .split('##')[0]!
    const highMatches = recent.match(/- High: /g) ?? []
    const mediumMatches = recent.match(/- Medium: /g) ?? []
    const lowMatches = recent.match(/- Low: /g) ?? []
    expect(highMatches.length).toBe(3)
    expect(mediumMatches.length).toBe(2)
    expect(lowMatches.length).toBe(0)
    // High issues must precede medium issues in the rendered list.
    const firstMediumIdx = recent.indexOf('- Medium: ')
    const lastHighIdx = recent.lastIndexOf('- High: ')
    expect(lastHighIdx).toBeLessThan(firstMediumIdx)
  })

  it('handles an empty extraction without crashing', async () => {
    const empty: ExtractionResult = {
      projectName: 'Empty',
      generatedAt: '2026-04-16T00:00:00.000Z',
      chapters: [],
      characters: [],
      locations: [],
      timeline: [],
      continuityIssues: [],
      tokenUsage: { inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0 },
      warnings: []
    }
    const emptyProject: ScrivenerProject = {
      ...project,
      chapters: []
    }
    const result = await generateVault(empty, emptyProject, vaultPath, {
      novelTitle: 'Empty'
    })
    expect(result.filesWritten).toBe(3) // timeline + continuity + dashboard
    const timeline = await readFile(
      join(vaultPath, 'Timeline', 'Master Timeline.md'),
      'utf8'
    )
    expect(timeline).toContain('No timeline events extracted.')
    const continuity = await readFile(
      join(vaultPath, 'Continuity', 'Flagged Issues.md'),
      'utf8'
    )
    expect(continuity).toContain('No continuity issues detected.')
  })

  it('warns and omits parent/synopsis when a chapter UUID is missing from the project', async () => {
    const projectMissingUuid: ScrivenerProject = {
      ...project,
      chapters: project.chapters.map((c) =>
        c.order === 3 ? { ...c, uuid: 'different-uuid' } : c
      )
    }
    await generateVault(extraction, projectMissingUuid, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const logPath = join(vaultPath, '_meta', 'extraction-log.json')
    const parsed = JSON.parse(await readFile(logPath, 'utf8'))
    const warnings = parsed.vaultWarnings as string[]
    expect(warnings.some((w) => w.includes('uuid-chapter-3'))).toBe(true)

    const ch3 = await readFile(
      join(vaultPath, 'Chapters', '03 - The Silver Tower.md'),
      'utf8'
    )
    expect(ch3).not.toMatch(/^parent:/m)
    expect(ch3).not.toMatch(/^synopsis:/m)
  })
})
