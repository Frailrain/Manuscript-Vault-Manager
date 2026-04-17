import { describe, expect, it } from 'vitest'

import { diffProject } from '../diff'
import {
  buildProjectV1,
  buildProjectV2_ch2Modified,
  buildProjectV3_insertedCh2b,
  buildProjectV4_removedCh3,
  buildProjectV5_reorderedCh2Ch3
} from './fixtures/projects'
import { buildManifestFor } from './fixtures/manifests'

describe('diffProject', () => {
  it('reports every chapter as "new" when manifest is null (first run)', () => {
    const project = buildProjectV1()
    const changes = diffProject(project, null)
    expect(changes).toHaveLength(3)
    expect(changes.every((c) => c.kind === 'new')).toBe(true)
    expect(changes.map((c) => c.chapterUuid)).toEqual(['ch-1', 'ch-2', 'ch-3'])
    expect(changes.map((c) => c.newOrder)).toEqual([1, 2, 3])
    expect(changes.every((c) => c.oldOrder === null)).toBe(true)
  })

  it('returns an empty list when nothing changed', () => {
    const project = buildProjectV1()
    const manifest = buildManifestFor(project)
    const changes = diffProject(project, manifest)
    expect(changes).toEqual([])
  })

  it('flags a scene-content edit as "modified"', () => {
    const v1 = buildProjectV1()
    const manifest = buildManifestFor(v1)
    const v2 = buildProjectV2_ch2Modified()
    const changes = diffProject(v2, manifest)
    expect(changes).toHaveLength(1)
    expect(changes[0]!.kind).toBe('modified')
    expect(changes[0]!.chapterUuid).toBe('ch-2')
    expect(changes[0]!.newOrder).toBe(2)
    expect(changes[0]!.oldOrder).toBe(2)
  })

  it('flags a newly inserted chapter as "new" and pushes others as "reordered" (not modified)', () => {
    const v1 = buildProjectV1()
    const manifest = buildManifestFor(v1)
    const v3 = buildProjectV3_insertedCh2b()
    const changes = diffProject(v3, manifest)

    const byUuid = new Map(changes.map((c) => [c.chapterUuid, c]))
    expect(byUuid.get('ch-2b')?.kind).toBe('new')
    expect(byUuid.get('ch-2b')?.newOrder).toBe(3)
    expect(byUuid.get('ch-3')?.kind).toBe('reordered')
    expect(byUuid.get('ch-3')?.newOrder).toBe(4)
    expect(byUuid.get('ch-3')?.oldOrder).toBe(3)
    // ch-1 and ch-2 keep their positions; they should not appear.
    expect(byUuid.has('ch-1')).toBe(false)
    expect(byUuid.has('ch-2')).toBe(false)
  })

  it('flags a removed chapter as "removed"', () => {
    const v1 = buildProjectV1()
    const manifest = buildManifestFor(v1)
    const v4 = buildProjectV4_removedCh3()
    const changes = diffProject(v4, manifest)
    expect(changes).toHaveLength(1)
    expect(changes[0]!.kind).toBe('removed')
    expect(changes[0]!.chapterUuid).toBe('ch-3')
    expect(changes[0]!.oldOrder).toBe(3)
    expect(changes[0]!.newOrder).toBe(null)
  })

  it('flags a pure reorder (content unchanged) as "reordered" and sorts new→modified→reordered→removed', () => {
    const v1 = buildProjectV1()
    const manifest = buildManifestFor(v1)
    const v5 = buildProjectV5_reorderedCh2Ch3()
    const changes = diffProject(v5, manifest)

    expect(changes).toHaveLength(2)
    expect(changes.every((c) => c.kind === 'reordered')).toBe(true)

    // Order: new=0, modified=1, reordered=2, removed=3 — confirm sort holds for a mixed diff.
    // Modify ch-2 AND drop ch-3 relative to v1.
    const v2dropped = {
      ...buildProjectV2_ch2Modified(),
      chapters: buildProjectV2_ch2Modified().chapters.filter(
        (c) => c.uuid !== 'ch-3'
      )
    }
    const mixed = diffProject(v2dropped, manifest)
    const kinds = mixed.map((c) => c.kind)
    expect(kinds).toEqual(['modified', 'removed'])
  })
})
