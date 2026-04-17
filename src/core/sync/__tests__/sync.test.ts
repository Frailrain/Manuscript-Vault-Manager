import { readFile, writeFile } from 'node:fs/promises'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance
} from 'vitest'

import type {
  LLMProviderConfig,
  SyncProgress,
  SyncResult
} from '../../../shared/types'
import { MockProvider } from '../../extraction/__tests__/mockProvider'
import { LLMProviderError } from '../../extraction/providers'
import * as providerFactory from '../../extraction/providers'
import { SyncError } from '../errors'
import { readManifest } from '../manifest'
import { syncProject } from '../sync'
import {
  buildProjectV1,
  buildProjectV2_ch2Modified,
  buildProjectV3_insertedCh2b,
  buildProjectV4_removedCh3,
  buildProjectV5_reorderedCh2Ch3
} from './fixtures/projects'

const providerConfig: LLMProviderConfig = {
  kind: 'anthropic',
  apiKey: 'test-key',
  model: 'claude-haiku-4-5'
}

let tempVault = ''
let createProviderSpy: MockInstance
let mock: MockProvider

beforeEach(() => {
  tempVault = mkdtempSync(join(tmpdir(), 'mvm-sync-'))
  mock = new MockProvider()
  createProviderSpy = vi
    .spyOn(providerFactory, 'createProvider')
    .mockReturnValue(mock)
})

afterEach(() => {
  rmSync(tempVault, { recursive: true, force: true })
  createProviderSpy.mockRestore()
})

async function run(
  project = buildProjectV1(),
  options: Partial<Parameters<typeof syncProject>[3]> = {}
): Promise<SyncResult> {
  return syncProject(project, tempVault, providerConfig, {
    novelTitle: 'Test Novel',
    ...options
  })
}

describe('syncProject', () => {
  it('first run (no manifest): extracts every chapter, writes vault + manifest', async () => {
    const project = buildProjectV1()
    const result = await run(project)

    expect(result.firstRun).toBe(true)
    expect(result.changes.every((c) => c.kind === 'new')).toBe(true)
    expect(result.extractedChapters).toBe(project.chapters.length)
    expect(result.tokenUsage.inputTokens).toBeGreaterThan(0)
    expect(result.filesWritten).toBeGreaterThan(0)

    const manifest = await readManifest(tempVault)
    expect(manifest).not.toBeNull()
    expect(manifest!.chapters).toHaveLength(project.chapters.length)
    expect(manifest!.chapterContributions).toHaveLength(project.chapters.length)
  })

  it('no-change sync: short-circuits without any LLM calls', async () => {
    await run(buildProjectV1())
    mock.calls.length = 0

    const result = await run(buildProjectV1())

    expect(result.firstRun).toBe(false)
    expect(result.changes).toEqual([])
    expect(result.extractedChapters).toBe(0)
    expect(result.filesWritten).toBe(0)
    expect(result.tokenUsage.inputTokens).toBe(0)
    expect(mock.calls).toHaveLength(0)
  })

  it('modified chapter: re-extracts only that chapter', async () => {
    await run(buildProjectV1())
    mock.calls.length = 0

    const result = await run(buildProjectV2_ch2Modified())

    expect(result.extractedChapters).toBe(1)
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]!.kind).toBe('modified')
    expect(result.changes[0]!.chapterUuid).toBe('ch-2')

    // Only ch-2 was re-extracted — expect 4 tool calls (one per pass).
    expect(mock.calls).toHaveLength(4)
    expect(mock.calls.every((c) => c.userPrompt.includes('Chapter 2'))).toBe(
      true
    )
  })

  it('reorder-only sync: no LLM calls but vault is regenerated with new orders', async () => {
    await run(buildProjectV1())
    mock.calls.length = 0

    const v5 = buildProjectV5_reorderedCh2Ch3()
    const result = await run(v5)

    expect(result.extractedChapters).toBe(0)
    expect(mock.calls).toHaveLength(0)
    expect(result.changes.every((c) => c.kind === 'reordered')).toBe(true)
    expect(result.filesWritten).toBeGreaterThan(0)

    const manifest = await readManifest(tempVault)
    const ch2 = manifest!.chapters.find((c) => c.chapterUuid === 'ch-2')
    expect(ch2?.chapterOrder).toBe(3)
  })

  it('inserted chapter: extracts only the new one', async () => {
    await run(buildProjectV1())
    mock.calls.length = 0

    const v3 = buildProjectV3_insertedCh2b()
    const result = await run(v3)

    expect(result.extractedChapters).toBe(1)
    const newChanges = result.changes.filter((c) => c.kind === 'new')
    expect(newChanges).toHaveLength(1)
    expect(newChanges[0]!.chapterUuid).toBe('ch-2b')

    expect(mock.calls.every((c) => c.userPrompt.includes('Chapter 2b'))).toBe(
      true
    )
  })

  it('removed chapter: drops from manifest without re-extraction', async () => {
    await run(buildProjectV1())
    mock.calls.length = 0

    const v4 = buildProjectV4_removedCh3()
    const result = await run(v4)

    expect(result.extractedChapters).toBe(0)
    expect(mock.calls).toHaveLength(0)
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]!.kind).toBe('removed')

    const manifest = await readManifest(tempVault)
    expect(manifest!.chapters.map((c) => c.chapterUuid)).toEqual([
      'ch-1',
      'ch-2'
    ])
    expect(
      manifest!.chapterContributions.map((c) => c.chapterUuid)
    ).toEqual(['ch-1', 'ch-2'])
  })

  it('dryRun: reports changes but makes no LLM calls and does not write vault or manifest', async () => {
    const result = await run(buildProjectV1(), { dryRun: true })

    expect(result.firstRun).toBe(true)
    expect(result.changes).toHaveLength(3)
    expect(result.extractedChapters).toBe(0)
    expect(result.filesWritten).toBe(0)
    expect(mock.calls).toHaveLength(0)
    expect(await readManifest(tempVault)).toBeNull()
  })

  it('wraps provider auth errors as SyncError(code=provider)', async () => {
    mock.respond = () =>
      new LLMProviderError('bad api key', 'auth')

    await expect(run(buildProjectV1())).rejects.toBeInstanceOf(SyncError)
    try {
      await run(buildProjectV1())
    } catch (err) {
      expect((err as SyncError).code).toBe('provider')
    }
  })

  it('fires progress callbacks covering every phase', async () => {
    const events: SyncProgress[] = []
    await run(buildProjectV1(), { onProgress: (p) => events.push(p) })

    const phases = new Set(events.map((e) => e.phase))
    expect(phases.has('reading-manifest')).toBe(true)
    expect(phases.has('diffing')).toBe(true)
    expect(phases.has('extracting')).toBe(true)
    expect(phases.has('merging')).toBe(true)
    expect(phases.has('regenerating-vault')).toBe(true)
    expect(phases.has('writing-manifest')).toBe(true)
    expect(phases.has('done')).toBe(true)

    const last = events[events.length - 1]!
    expect(last.phase).toBe('done')
    expect(last.tokensUsedSoFar).toBeGreaterThan(0)
  })

  it('preserves Writer\'s Notes when a chapter is re-extracted', async () => {
    await run(buildProjectV1())

    // Find the ch-2 vault file and inject Writer's Notes.
    const chaptersDir = join(tempVault, 'Chapters')
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(chaptersDir)
    const ch2File = entries.find((f) => f.includes('Chapter 2'))
    expect(ch2File).toBeDefined()
    const ch2Path = join(chaptersDir, ch2File!)
    const existing = await readFile(ch2Path, 'utf8')
    const withNotes = existing.includes("## Writer's Notes")
      ? existing.replace(
          /## Writer's Notes[\s\S]*?(?=\n## |$)/,
          "## Writer's Notes\n\nMy important note about this chapter.\n\n"
        )
      : existing + "\n## Writer's Notes\n\nMy important note about this chapter.\n"
    await writeFile(ch2Path, withNotes, 'utf8')

    // Re-sync with ch-2 modified.
    await run(buildProjectV2_ch2Modified())

    const after = await readFile(ch2Path, 'utf8')
    expect(after).toContain('My important note about this chapter.')
  })
})
