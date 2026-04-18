import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type {
  ExtractedCharacter,
  ExtractedLocation,
  ManifestChapterEntry
} from '../../../shared/types'
import { checkVaultIntegrity } from '../integrity'

function ch(
  order: number,
  title: string,
  uuid = `ch-${order}`
): ManifestChapterEntry {
  return {
    chapterUuid: uuid,
    chapterOrder: order,
    chapterTitle: title,
    chapterHash: 'x',
    sceneHashes: []
  }
}

function char(
  name: string,
  tier: ExtractedCharacter['tier'] = 'main'
): ExtractedCharacter {
  return {
    name,
    aliases: [],
    description: '',
    chapterActivity: {},
    role: '',
    relationships: [],
    firstAppearanceChapter: 1,
    appearances: [1],
    tier,
    customFields: {}
  }
}

function loc(
  name: string,
  parentLocation: string | null = null
): ExtractedLocation {
  return {
    name,
    description: '',
    significance: '',
    firstAppearanceChapter: 1,
    appearances: [1],
    parentLocation,
    customFields: {}
  }
}

function touch(root: string, relPath: string): void {
  const abs = join(root, relPath)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, '')
}

function writeAllExpected(
  root: string,
  inputs: {
    chapters: ManifestChapterEntry[]
    characters: ExtractedCharacter[]
    locations: ExtractedLocation[]
    hasTimeline: boolean
    hasContinuity: boolean
  }
): void {
  for (const c of inputs.chapters) {
    touch(
      root,
      join(
        'Chapters',
        `${String(c.chapterOrder).padStart(2, '0')} - ${c.chapterTitle}.md`
      )
    )
  }
  for (const c of inputs.characters) {
    const tierFolder =
      c.tier === 'main'
        ? '1 - Main'
        : c.tier === 'secondary'
          ? '2 - Secondary'
          : c.tier === 'minor'
            ? '3 - Minor'
            : '4 - Mentioned'
    touch(root, join('Characters', tierFolder, `${c.name}.md`))
  }
  for (const l of inputs.locations) {
    if (l.parentLocation) {
      touch(root, join('Locations', l.parentLocation, `${l.name}.md`))
    } else {
      touch(root, join('Locations', `${l.name}.md`))
    }
  }
  touch(root, 'Dashboard.md')
  if (inputs.hasTimeline) touch(root, join('Timeline', 'Master Timeline.md'))
  if (inputs.hasContinuity)
    touch(root, join('Continuity', 'Flagged Issues.md'))
}

describe('checkVaultIntegrity', () => {
  let root = ''

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mvm-integrity-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('reports all present when every expected file exists', async () => {
    const inputs = {
      chapters: [ch(1, 'One'), ch(2, 'Two')],
      characters: [char('Elara'), char('Vorn', 'secondary')],
      locations: [loc('Tower')],
      hasTimeline: true,
      hasContinuity: true
    }
    writeAllExpected(root, inputs)
    const result = await checkVaultIntegrity(root, inputs)
    expect(result.hasMissingFiles).toBe(false)
    expect(result.missingCount).toBe(0)
    expect(result.missingFiles).toEqual([])
  })

  it('detects a missing chapter file', async () => {
    const inputs = {
      chapters: [ch(1, 'One'), ch(2, 'Two')],
      characters: [char('Elara')],
      locations: [loc('Tower')],
      hasTimeline: true,
      hasContinuity: true
    }
    writeAllExpected(root, inputs)
    rmSync(join(root, 'Chapters', '02 - Two.md'))
    const result = await checkVaultIntegrity(root, inputs)
    expect(result.hasMissingFiles).toBe(true)
    expect(result.missingCount).toBe(1)
    expect(result.missingFiles).toContain(join('Chapters', '02 - Two.md'))
  })

  it('detects a missing character file under its tier folder', async () => {
    const inputs = {
      chapters: [ch(1, 'One')],
      characters: [char('Elara'), char('Vorn', 'secondary')],
      locations: [loc('Tower')],
      hasTimeline: true,
      hasContinuity: true
    }
    writeAllExpected(root, inputs)
    rmSync(join(root, 'Characters', '2 - Secondary', 'Vorn.md'))
    const result = await checkVaultIntegrity(root, inputs)
    expect(result.hasMissingFiles).toBe(true)
    expect(result.missingCount).toBe(1)
    expect(result.missingFiles).toContain(
      join('Characters', '2 - Secondary', 'Vorn.md')
    )
  })

  it('detects a missing location file', async () => {
    const inputs = {
      chapters: [ch(1, 'One')],
      characters: [char('Elara')],
      locations: [loc('Tower'), loc('Redgate')],
      hasTimeline: true,
      hasContinuity: true
    }
    writeAllExpected(root, inputs)
    rmSync(join(root, 'Locations', 'Redgate.md'))
    const result = await checkVaultIntegrity(root, inputs)
    expect(result.hasMissingFiles).toBe(true)
    expect(result.missingCount).toBe(1)
    expect(result.missingFiles).toContain(join('Locations', 'Redgate.md'))
  })

  it('detects multiple missing files across categories', async () => {
    const inputs = {
      chapters: [ch(1, 'One'), ch(2, 'Two')],
      characters: [char('Elara'), char('Vorn', 'secondary')],
      locations: [loc('Tower'), loc('Redgate')],
      hasTimeline: true,
      hasContinuity: true
    }
    writeAllExpected(root, inputs)
    rmSync(join(root, 'Chapters', '01 - One.md'))
    rmSync(join(root, 'Characters', '1 - Main', 'Elara.md'))
    rmSync(join(root, 'Locations', 'Tower.md'))
    const result = await checkVaultIntegrity(root, inputs)
    expect(result.hasMissingFiles).toBe(true)
    expect(result.missingCount).toBe(3)
    expect(result.missingFiles).toContain(join('Chapters', '01 - One.md'))
    expect(result.missingFiles).toContain(
      join('Characters', '1 - Main', 'Elara.md')
    )
    expect(result.missingFiles).toContain(join('Locations', 'Tower.md'))
  })

  it('detects a missing Dashboard.md', async () => {
    const inputs = {
      chapters: [ch(1, 'One')],
      characters: [char('Elara')],
      locations: [loc('Tower')],
      hasTimeline: true,
      hasContinuity: true
    }
    writeAllExpected(root, inputs)
    rmSync(join(root, 'Dashboard.md'))
    const result = await checkVaultIntegrity(root, inputs)
    expect(result.hasMissingFiles).toBe(true)
    expect(result.missingFiles).toContain('Dashboard.md')
  })

  it('detects missing Timeline/Continuity files when snapshot has them', async () => {
    const inputs = {
      chapters: [ch(1, 'One')],
      characters: [char('Elara')],
      locations: [loc('Tower')],
      hasTimeline: true,
      hasContinuity: true
    }
    writeAllExpected(root, inputs)
    rmSync(join(root, 'Timeline', 'Master Timeline.md'))
    rmSync(join(root, 'Continuity', 'Flagged Issues.md'))
    const result = await checkVaultIntegrity(root, inputs)
    expect(result.missingCount).toBe(2)
    expect(result.missingFiles).toContain(
      join('Timeline', 'Master Timeline.md')
    )
    expect(result.missingFiles).toContain(
      join('Continuity', 'Flagged Issues.md')
    )
  })

  it('does not report Timeline/Continuity when snapshot is empty', async () => {
    const inputs = {
      chapters: [ch(1, 'One')],
      characters: [char('Elara')],
      locations: [loc('Tower')],
      hasTimeline: false,
      hasContinuity: false
    }
    writeAllExpected(root, inputs)
    const result = await checkVaultIntegrity(root, inputs)
    expect(result.hasMissingFiles).toBe(false)
    expect(result.missingCount).toBe(0)
  })

  it('caps missingFiles at 50 but missingCount reflects the true total', async () => {
    const chapters: ManifestChapterEntry[] = []
    for (let i = 1; i <= 60; i++) chapters.push(ch(i, `C${i}`))
    const inputs = {
      chapters,
      characters: [],
      locations: [],
      hasTimeline: false,
      hasContinuity: false
    }
    // Write nothing: all chapter files + Dashboard.md missing.
    const result = await checkVaultIntegrity(root, inputs)
    expect(result.missingCount).toBe(61)
    expect(result.missingFiles.length).toBe(50)
  })

  it('reports every expected file as missing in an empty vault', async () => {
    const inputs = {
      chapters: [ch(1, 'One')],
      characters: [char('Elara')],
      locations: [loc('Tower')],
      hasTimeline: true,
      hasContinuity: true
    }
    const result = await checkVaultIntegrity(root, inputs)
    expect(result.missingCount).toBe(6)
    expect(result.missingFiles).toContain(join('Chapters', '01 - One.md'))
    expect(result.missingFiles).toContain(
      join('Characters', '1 - Main', 'Elara.md')
    )
    expect(result.missingFiles).toContain(join('Locations', 'Tower.md'))
    expect(result.missingFiles).toContain('Dashboard.md')
    expect(result.missingFiles).toContain(
      join('Timeline', 'Master Timeline.md')
    )
    expect(result.missingFiles).toContain(
      join('Continuity', 'Flagged Issues.md')
    )
  })
})
