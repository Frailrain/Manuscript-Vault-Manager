import type {
  ChapterChange,
  ChapterChangeKind,
  ScrivenerProject,
  SyncManifest
} from '../../shared/types'
import { hashChapter } from './hashing'

const KIND_ORDER: Record<ChapterChangeKind, number> = {
  new: 0,
  modified: 1,
  reordered: 2,
  removed: 3
}

export function diffProject(
  project: ScrivenerProject,
  manifest: SyncManifest | null
): ChapterChange[] {
  const changes: ChapterChange[] = []

  if (!manifest) {
    for (const chapter of project.chapters) {
      changes.push({
        kind: 'new',
        chapterUuid: chapter.uuid,
        newOrder: chapter.order,
        oldOrder: null,
        title: chapter.title
      })
    }
    return sortChanges(changes)
  }

  const manifestByUuid = new Map(
    manifest.chapters.map((ch) => [ch.chapterUuid, ch])
  )
  const currentByUuid = new Map(
    project.chapters.map((ch) => [ch.uuid, ch])
  )

  for (const chapter of project.chapters) {
    const prior = manifestByUuid.get(chapter.uuid)
    if (!prior) {
      changes.push({
        kind: 'new',
        chapterUuid: chapter.uuid,
        newOrder: chapter.order,
        oldOrder: null,
        title: chapter.title
      })
      continue
    }
    const currentHash = hashChapter(chapter)
    if (currentHash !== prior.chapterHash) {
      changes.push({
        kind: 'modified',
        chapterUuid: chapter.uuid,
        newOrder: chapter.order,
        oldOrder: prior.chapterOrder,
        title: chapter.title
      })
      continue
    }
    if (prior.chapterOrder !== chapter.order) {
      changes.push({
        kind: 'reordered',
        chapterUuid: chapter.uuid,
        newOrder: chapter.order,
        oldOrder: prior.chapterOrder,
        title: chapter.title
      })
    }
  }

  for (const prior of manifest.chapters) {
    if (!currentByUuid.has(prior.chapterUuid)) {
      changes.push({
        kind: 'removed',
        chapterUuid: prior.chapterUuid,
        newOrder: null,
        oldOrder: prior.chapterOrder,
        title: prior.chapterTitle
      })
    }
  }

  return sortChanges(changes)
}

function sortChanges(changes: ChapterChange[]): ChapterChange[] {
  return changes.slice().sort((a, b) => {
    const kindDelta = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    if (kindDelta !== 0) return kindDelta
    const aOrder = a.newOrder ?? a.oldOrder ?? 0
    const bOrder = b.newOrder ?? b.oldOrder ?? 0
    return aOrder - bOrder
  })
}
