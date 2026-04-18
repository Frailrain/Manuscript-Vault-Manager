import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'

import type { SyncManifest } from '../../../shared/types'
import { SyncError } from '../errors'
import { manifestPath, readManifest, writeManifest } from '../manifest'

let tempDir = ''

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'mvm-manifest-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

function sampleManifest(): SyncManifest {
  return {
    version: 1,
    lastSyncAt: '2026-04-16T00:00:00.000Z',
    projectName: 'test',
    chapters: [
      {
        chapterUuid: 'ch-1',
        chapterOrder: 1,
        chapterTitle: 'Chapter 1',
        chapterHash: 'abc123',
        sceneHashes: [{ uuid: 'sc-1', hash: 'h1' }]
      }
    ],
    chapterContributions: [
      {
        chapterOrder: 1,
        chapterUuid: 'ch-1',
        characterDeltas: [],
        locationDeltas: [],
        timelineEvents: [],
        continuityIssues: []
      }
    ],
    cumulativeTokenUsage: {
      inputTokens: 100,
      outputTokens: 50,
      estimatedCostUSD: 0.001
    },
    lastExtractionSnapshot: {
      chapters: [
        {
          chapterOrder: 1,
          chapterUuid: 'ch-1',
          chapterTitle: 'Chapter 1',
          summary: 'A summary.',
          charactersAppearing: [],
          locationsAppearing: []
        }
      ],
      warnings: []
    }
  }
}

describe('manifest', () => {
  it('manifestPath joins to _meta/manifest.json', () => {
    expect(manifestPath('/some/vault')).toBe(
      join('/some/vault', '_meta', 'manifest.json')
    )
  })

  it('readManifest returns null when the file does not exist', async () => {
    const result = await readManifest(tempDir)
    expect(result).toBeNull()
  })

  it('writeManifest then readManifest roundtrips the data', async () => {
    const m = sampleManifest()
    await writeManifest(tempDir, m)
    const parsed = await readManifest(tempDir)
    expect(parsed).toEqual(m)
  })

  it('readManifest throws SyncError(code=manifest) on malformed JSON', async () => {
    const path = manifestPath(tempDir)
    await mkdir(join(tempDir, '_meta'), { recursive: true })
    await writeFile(path, '{not valid json', 'utf8')
    await expect(readManifest(tempDir)).rejects.toBeInstanceOf(SyncError)
    try {
      await readManifest(tempDir)
    } catch (err) {
      expect((err as SyncError).code).toBe('manifest')
    }
  })

  it('readManifest throws SyncError(code=manifest) on wrong version', async () => {
    const path = manifestPath(tempDir)
    await mkdir(join(tempDir, '_meta'), { recursive: true })
    await writeFile(path, JSON.stringify({ version: 99, foo: 'bar' }), 'utf8')
    await expect(readManifest(tempDir)).rejects.toBeInstanceOf(SyncError)
    try {
      await readManifest(tempDir)
    } catch (err) {
      expect((err as SyncError).code).toBe('manifest')
      expect((err as SyncError).message).toContain('incompatible')
    }
  })

  it('writeManifest writes atomically (.tmp first, then rename)', async () => {
    const m = sampleManifest()
    await writeManifest(tempDir, m)
    const path = manifestPath(tempDir)
    const raw = await readFile(path, 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    expect(JSON.parse(raw)).toEqual(m)
    // No leftover .tmp file.
    await expect(readFile(`${path}.tmp`, 'utf8')).rejects.toThrow()
  })
})
