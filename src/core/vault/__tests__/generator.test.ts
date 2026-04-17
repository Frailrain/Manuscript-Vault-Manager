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
    expect(content).not.toContain('MVM:MANAGED')
    expect(content).toMatch(
      /## Summary\n\nElara reaches the Silver Tower and confronts the Archivist\./
    )
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
      join(vaultPath, 'Characters', 'Main', 'Elara.md'),
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
      join(vaultPath, 'Characters', 'Secondary', 'Captain Vorn.md'),
      'utf8'
    )
    expect(vorn).not.toMatch(/^aliases:/m)
  })

  it('places an "At a Glance" abstract callout immediately after the H1 in character files', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const elara = await readFile(
      join(vaultPath, 'Characters', 'Main', 'Elara.md'),
      'utf8'
    )
    expect(elara).toMatch(
      /# Elara\n\n> \[!abstract\] At a Glance\n> \*\*Role:\*\* protagonist, first-year academy scholar\n> \*\*First seen:\*\* Chapter 1\n> \*\*Appears in:\*\* 3 chapters/
    )
  })

  it('renders a synthesized identity paragraph and a foldable per-chapter activity callout', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const elara = await readFile(
      join(vaultPath, 'Characters', 'Main', 'Elara.md'),
      'utf8'
    )
    expect(elara).toContain(
      'Tall, grey-eyed scholar with a scar across her cheek, who carries a silver knife engraved with an unknown crest.'
    )
    expect(elara).toContain('> [!note]- Per-chapter activity')
    expect(elara).toContain('> **Chapter 1:**')
    expect(elara).toContain('> - Arrives at the academy gates.')
    expect(elara).toContain('> - Meets Vorn for the first time.')
    expect(elara).toContain('> **Chapter 3:**')
    expect(elara).toContain('> - Ascends the Silver Tower alone.')
    expect(elara).toContain('> - Confronts the Archivist in the archive.')
  })

  it('sentence-splits a chapterActivity string into one bullet per sentence', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const vorn = await readFile(
      join(vaultPath, 'Characters', 'Secondary', 'Captain Vorn.md'),
      'utf8'
    )
    expect(vorn).toContain('> [!note]- Per-chapter activity')
    expect(vorn).toContain('> **Chapter 1:**')
    expect(vorn).toContain('> - Challenges Elara to a sparring match.')
    expect(vorn).toContain('> **Chapter 2:**')
    expect(vorn).toContain('> - Flees Redgate with Elara after the breach.')
  })

  it("omits the separate '## Role' heading from character files", async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const elara = await readFile(
      join(vaultPath, 'Characters', 'Main', 'Elara.md'),
      'utf8'
    )
    expect(elara).not.toMatch(/^## Role\s*$/m)
  })

  it('renders relationships as a single foldable callout with bulleted wiki-links', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const elara = await readFile(
      join(vaultPath, 'Characters', 'Main', 'Elara.md'),
      'utf8'
    )
    expect(elara).toContain('> [!info]- Relationships (2)')
    expect(elara).toContain(
      '> - **[[Captain Vorn]]** — mentor, trained her at the academy'
    )
    expect(elara).toContain(
      '> - **[[The Archivist]]** — adversary, withholds information'
    )
    expect(elara).not.toContain('> [!info] [[Captain Vorn]]')
    expect(elara).not.toContain('> [!info] [[The Archivist]]')
  })

  it('renders "(none recorded)" when a character has no relationships', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const archivist = await readFile(
      join(vaultPath, 'Characters', 'Minor', 'The Archivist.md'),
      'utf8'
    )
    expect(archivist).toContain('## Relationships\n\n*(none recorded)*')
    expect(archivist).not.toContain('> [!info]- Relationships')
  })

  it('omits the per-chapter activity callout when chapterActivity is empty', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const archivist = await readFile(
      join(vaultPath, 'Characters', 'Minor', 'The Archivist.md'),
      'utf8'
    )
    expect(archivist).not.toContain('> [!note]- Per-chapter activity')
  })

  it('omits Role line in "At a Glance" when role is empty', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const archivist = await readFile(
      join(vaultPath, 'Characters', 'Minor', 'The Archivist.md'),
      'utf8'
    )
    expect(archivist).toContain('> [!abstract] At a Glance')
    const glance = archivist.split('> [!abstract] At a Glance')[1]!
    const glanceBlock = glance.split('\n\n')[0]!
    expect(glanceBlock).not.toMatch(/\*\*Role:\*\*/)
    expect(glanceBlock).toContain('**First seen:** Chapter 3')
    expect(glanceBlock).toContain('**Appears in:** 1 chapter')
  })

  it('renders location "At a Glance" with Significance when present and synthesized description', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const silverTower = await readFile(
      join(vaultPath, 'Locations', 'The Silver Tower.md'),
      'utf8'
    )
    expect(silverTower).toContain('> [!abstract] At a Glance')
    expect(silverTower).toContain('**First seen:** Chapter 3')
    expect(silverTower).toContain(
      '**Significance:** Home of the Archivist and the banned texts.'
    )
    expect(silverTower).toContain('> [!note]- Per-chapter detail')
    expect(silverTower).toContain('> **Chapter 3:** A tall spire')
  })

  it('omits Significance line from location "At a Glance" when empty', async () => {
    const withEmptySig: ExtractionResult = {
      ...extraction,
      locations: extraction.locations.map((loc) =>
        loc.name === 'The Academy' ? { ...loc, significance: '' } : loc
      )
    }
    await generateVault(withEmptySig, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const academy = await readFile(
      join(vaultPath, 'Locations', 'The Academy.md'),
      'utf8'
    )
    expect(academy).toContain('> [!abstract] At a Glance')
    const glance = academy.split('> [!abstract] At a Glance')[1]!
    const glanceBlock = glance.split('\n\n')[0]!
    expect(glanceBlock).not.toMatch(/\*\*Significance:\*\*/)
  })

  it('renders Chapter Card abstract callout when parent or synopsis exists', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const ch1 = await readFile(
      join(vaultPath, 'Chapters', '01 - The Academy.md'),
      'utf8'
    )
    expect(ch1).toContain('> [!abstract] Chapter Card')
    expect(ch1).toContain('> **Part:** Part One')
    expect(ch1).toContain('> **Scrivener synopsis:** Elara arrives.')
  })

  it('omits Chapter Card when neither parent nor synopsis is present', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const ch2 = await readFile(
      join(vaultPath, 'Chapters', '02 - Redgate.md'),
      'utf8'
    )
    expect(ch2).not.toContain('> [!abstract] Chapter Card')
  })

  it('renders chapter events inside a "> [!example] Events" callout', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const ch3 = await readFile(
      join(vaultPath, 'Chapters', '03 - The Silver Tower.md'),
      'utf8'
    )
    expect(ch3).toContain('> [!example] Events')
    expect(ch3).toContain('> 1. Elara ascends the Silver Tower alone.')
    expect(ch3).toContain('> 2. The Archivist blocks her path to the archive.')
  })

  it('renders chapter Characters and Locations as single-line info callouts with middle-dot separators', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const ch3 = await readFile(
      join(vaultPath, 'Chapters', '03 - The Silver Tower.md'),
      'utf8'
    )
    expect(ch3).toContain(
      '> [!info] Characters\n> [[Elara]] · [[The Archivist]]'
    )
    expect(ch3).toContain(
      '> [!info] Locations\n> [[The Silver Tower]]'
    )
    expect(ch3).not.toMatch(/^## Characters Appearing\s*$/m)
    expect(ch3).not.toMatch(/^## Locations\s*$/m)
    expect(ch3).not.toMatch(/^## Events\s*$/m)
  })

  it("preserves Writer's Notes text on regeneration", async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const elaraPath = join(vaultPath, 'Characters', 'Main', 'Elara.md')
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
    const elaraPath = join(vaultPath, 'Characters', 'Main', 'Elara.md')
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
    expect(first.filesWritten).toBe(12)
    expect(first.filesPreserved).toBe(0)

    const notesPath = join(vaultPath, 'Characters', 'Main', 'Elara.md')
    const notesContent = (await readFile(notesPath, 'utf8')).replace(
      "## Writer's Notes\n",
      "## Writer's Notes\n\nKeep me.\n"
    )
    await writeFile(notesPath, notesContent, 'utf8')

    const second = await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    expect(second.filesWritten).toBe(12)
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

  it('groups continuity issues by severity and maps each to a severity-colored callout', async () => {
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
    expect(content).toContain(
      "> [!danger] Chapter 3: Elara's eye colour is described as grey in Chapter 1"
    )
    expect(content).toContain('> **Description:**')
    expect(content).toContain('> **Suggestion:**')
    expect(content).toContain(
      '> [!warning] Chapter 2: Vorn is described as left-handed in Ch 1 but sheathes on h'
    )
    expect(content).not.toMatch(/^### Chapter \d+: /m)
  })

  it('maps low-severity continuity issues to the caution callout', async () => {
    const withLow: ExtractionResult = {
      ...extraction,
      continuityIssues: [
        {
          severity: 'low',
          description: 'Weather detail drift.',
          chapters: [5],
          suggestion: 'Reconcile rain description.'
        }
      ]
    }
    await generateVault(withLow, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const content = await readFile(
      join(vaultPath, 'Continuity', 'Flagged Issues.md'),
      'utf8'
    )
    expect(content).toContain('## Low Severity')
    expect(content).toContain('> [!caution] Chapter 5: Weather detail drift')
  })

  it('renders a Stats abstract callout on the dashboard with middle-dot separators', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const dash = await readFile(join(vaultPath, 'Dashboard.md'), 'utf8')
    expect(dash).toContain('> [!abstract] Stats')
    expect(dash).toMatch(
      /> \*\*Chapters:\*\* 3 · \*\*Characters:\*\* 3 · \*\*Locations:\*\* 3 · \*\*Events:\*\* 6/
    )
    expect(dash).toMatch(
      /> \*\*Continuity issues:\*\* 2 \(1 high · 1 medium · 0 low\)/
    )
    expect(dash).toMatch(/> \*\*Last sync:\*\* \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC · \$0\.1[45]/)
    expect(dash).not.toMatch(/^## Stats\s*$/m)
    expect(dash).not.toMatch(/^## Last Sync\s*$/m)
  })

  it('renders a Recent High-Severity Issues danger callout only when high-severity issues exist', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const dash = await readFile(join(vaultPath, 'Dashboard.md'), 'utf8')
    expect(dash).toContain('> [!danger] Recent High-Severity Issues')
    expect(dash).toMatch(
      /> - \[\[Flagged Issues#Chapter 3: Elara's eye colour is described as grey in Chapter 1 and blu…\]\]/
    )
  })

  it('omits Recent High-Severity Issues callout when no high-severity issues exist', async () => {
    const noHigh: ExtractionResult = {
      ...extraction,
      continuityIssues: extraction.continuityIssues.filter(
        (i) => i.severity !== 'high'
      )
    }
    await generateVault(noHigh, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const dash = await readFile(join(vaultPath, 'Dashboard.md'), 'utf8')
    expect(dash).not.toContain('> [!danger] Recent High-Severity Issues')
  })

  it('renders "Continuity issues: none" in Stats when there are zero issues', async () => {
    const noIssues: ExtractionResult = {
      ...extraction,
      continuityIssues: []
    }
    await generateVault(noIssues, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const dash = await readFile(join(vaultPath, 'Dashboard.md'), 'utf8')
    expect(dash).toContain('> **Continuity issues:** none')
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
      warnings: [],
      chapterContributions: []
    }
    const emptyProject: ScrivenerProject = {
      ...project,
      chapters: []
    }
    const result = await generateVault(empty, emptyProject, vaultPath, {
      novelTitle: 'Empty'
    })
    expect(result.filesWritten).toBe(3)
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

  it('creates all four character tier subfolders even when a tier has no characters', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    for (const tier of ['Main', 'Secondary', 'Minor', 'Mentioned']) {
      expect(await pathExists(join(vaultPath, 'Characters', tier))).toBe(true)
    }
  })

  it('writes a mentioned-tier character into Characters/Mentioned/', async () => {
    const withMentioned: ExtractionResult = {
      ...extraction,
      characters: [
        ...extraction.characters,
        {
          name: 'Queen Mira',
          aliases: [],
          description: 'Referenced only in letters.',
          chapterActivity: {},
          role: '',
          relationships: [],
          firstAppearanceChapter: 1,
          appearances: [],
          tier: 'mentioned',
          customFields: {}
        }
      ]
    }
    await generateVault(withMentioned, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    expect(
      await pathExists(
        join(vaultPath, 'Characters', 'Mentioned', 'Queen Mira.md')
      )
    ).toBe(true)
  })

  it('chapter Characters callout uses basename wiki-links, not tier paths', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const ch3 = await readFile(
      join(vaultPath, 'Chapters', '03 - The Silver Tower.md'),
      'utf8'
    )
    expect(ch3).not.toContain('[[Main/Elara]]')
    expect(ch3).not.toContain('[[Minor/The Archivist]]')
    expect(ch3).toContain('[[Elara]]')
    expect(ch3).toContain('[[The Archivist]]')
  })

  it('nests a sub-location beneath its parent folder', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    expect(
      await pathExists(
        join(vaultPath, 'Locations', 'The Silver Tower', 'The Archive.md')
      )
    ).toBe(true)
    expect(
      await pathExists(join(vaultPath, 'Locations', 'The Silver Tower.md'))
    ).toBe(true)
  })

  it('renders a Sub-locations callout on a parent location with children', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const silverTower = await readFile(
      join(vaultPath, 'Locations', 'The Silver Tower.md'),
      'utf8'
    )
    expect(silverTower).toContain('> [!info] Sub-locations')
    expect(silverTower).toContain('> - [[The Archive]]')
  })

  it('omits the Sub-locations callout on a leaf location', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const academy = await readFile(
      join(vaultPath, 'Locations', 'The Academy.md'),
      'utf8'
    )
    expect(academy).not.toContain('Sub-locations')
  })

  it('renders main characters on the dashboard inline with tier and appearance count', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const dash = await readFile(join(vaultPath, 'Dashboard.md'), 'utf8')
    expect(dash).toContain('- [[Elara]] (main, 3 chapters)')
  })

  it('collapses non-main characters into a foldable "Other Characters" callout with populated subsections only', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const dash = await readFile(join(vaultPath, 'Dashboard.md'), 'utf8')
    expect(dash).toContain('> [!info]- Other Characters (2)')
    expect(dash).toContain('> ### Secondary')
    expect(dash).toContain('> - [[Captain Vorn]] (2 chapters)')
    expect(dash).toContain('> ### Minor')
    expect(dash).toContain('> - [[The Archivist]] (1 chapter)')
    expect(dash).not.toContain('> ### Mentioned')
  })

  it('labels a mentioned character with zero appearances as "only referenced" on the dashboard', async () => {
    const withMentioned: ExtractionResult = {
      ...extraction,
      characters: [
        ...extraction.characters,
        {
          name: 'Queen Mira',
          aliases: [],
          description: 'Never appears on-page.',
          chapterActivity: {},
          role: '',
          relationships: [],
          firstAppearanceChapter: 1,
          appearances: [],
          tier: 'mentioned',
          customFields: {}
        }
      ]
    }
    await generateVault(withMentioned, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const dash = await readFile(join(vaultPath, 'Dashboard.md'), 'utf8')
    expect(dash).toContain('> ### Mentioned')
    expect(dash).toContain('> - [[Queen Mira]] (only referenced)')
  })

  it('lists only top-level locations on the dashboard', async () => {
    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })
    const dash = await readFile(join(vaultPath, 'Dashboard.md'), 'utf8')
    const locationsSection = dash.split('## Locations')[1]!.split('## Chapters')[0]!
    expect(locationsSection).toContain('[[The Academy]]')
    expect(locationsSection).toContain('[[The Silver Tower]]')
    expect(locationsSection).not.toContain('[[The Archive]]')
  })

  it('removes legacy top-level Characters/*.md files left over from a pre-tier layout', async () => {
    await mkdir(join(vaultPath, 'Characters'), { recursive: true })
    const legacyPath = join(vaultPath, 'Characters', 'Elara.md')
    await writeFile(legacyPath, '---\ntype: "character"\n---\nstale\n', 'utf8')

    await generateVault(extraction, project, vaultPath, {
      novelTitle: 'Mini Test Novel'
    })

    expect(await pathExists(legacyPath)).toBe(false)
    expect(
      await pathExists(join(vaultPath, 'Characters', 'Main', 'Elara.md'))
    ).toBe(true)
    const parsed = JSON.parse(
      await readFile(join(vaultPath, '_meta', 'extraction-log.json'), 'utf8')
    )
    const warnings = parsed.vaultWarnings as string[]
    expect(warnings.some((w) => w.toLowerCase().includes('legacy'))).toBe(true)
  })
})
