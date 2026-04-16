// Flattening rules for the DraftFolder subtree of a Scrivener binder.
//
// Corrected in response to Task 1 after Brief #1: the previous Model B made
// every Folder a Part and every Text a chapter, which produced one-chapter-
// per-scene output for classic Scrivener manuscripts (Chapter folder → Scene
// texts). The rules below preserve Scrivener's native Chapter-with-Scenes
// intent.
//
//   1. Text directly under Draft → single-scene chapter, parentTitle=null.
//   2. Folder → chapter whose scenes are its Text children (in order), iff the
//      folder has no subfolder children. parentTitle is null for a top-level
//      Draft child, or the title of the nearest enclosing folder otherwise.
//   3. Folder with subfolder children → container ("Part"). Not emitted as a
//      chapter. Recurse into its children with parentTitle tracking.
//   4. Text nested inside a container (not inside a chapter folder) gets
//      promoted to a single-scene chapter with parentTitle=nearest ancestor
//      and a warning.
//   5. Deeper nesting (>1 container ancestor above a chapter) emits a warning
//      noting that ancestors beyond the nearest were dropped.
//   6. A chapter folder's own body RTF, if non-empty, is emitted by the
//      orchestrator as an "(Chapter intro)" scene at order 0.
//   7. IncludeInCompile="No" items (and their subtrees) are skipped entirely.
//      Callers are responsible for excluding Research/Trash top-level folders
//      before invoking flattenDraft.

import type { RawBinderItem } from './scrivx'

export type FlatChapterKind = 'leaf-text' | 'folder'

export interface FlatChapter {
  source: RawBinderItem
  kind: FlatChapterKind
  parentTitle: string | null
  sceneItems: RawBinderItem[]
}

export function flattenDraft(
  draft: RawBinderItem,
  warnings: string[]
): FlatChapter[] {
  const chapters: FlatChapter[] = []
  walk(draft.children, [], chapters, warnings)
  return chapters
}

function walk(
  items: RawBinderItem[],
  ancestors: RawBinderItem[],
  chapters: FlatChapter[],
  warnings: string[]
): void {
  for (const item of items) {
    if (!item.includeInCompile) continue

    if (item.type === 'Text') {
      emitText(item, ancestors, chapters, warnings)
      continue
    }

    if (item.type !== 'Folder') continue

    const activeFolders = item.children.filter(
      (c) => c.type === 'Folder' && c.includeInCompile
    )
    const activeTexts = item.children.filter(
      (c) => c.type === 'Text' && c.includeInCompile
    )

    if (activeFolders.length === 0) {
      emitChapterFolder(item, activeTexts, ancestors, chapters, warnings)
    } else {
      walk(item.children, [...ancestors, item], chapters, warnings)
    }
  }
}

function emitText(
  item: RawBinderItem,
  ancestors: RawBinderItem[],
  chapters: FlatChapter[],
  warnings: string[]
): void {
  if (ancestors.length === 0) {
    chapters.push({ source: item, kind: 'leaf-text', parentTitle: null, sceneItems: [] })
    return
  }
  const nearest = ancestors[ancestors.length - 1]!
  warnings.push(
    `Text "${item.title}" nested inside container "${nearest.title}" without a chapter folder; promoted to single-scene chapter.`
  )
  if (ancestors.length > 1) {
    const dropped = ancestors
      .slice(0, -1)
      .map((a) => a.title)
      .join(' > ')
    warnings.push(
      `Text "${item.title}" nested below "${dropped}"; parent set to "${nearest.title}" (deeper ancestors dropped).`
    )
  }
  chapters.push({
    source: item,
    kind: 'leaf-text',
    parentTitle: nearest.title,
    sceneItems: []
  })
}

function emitChapterFolder(
  folder: RawBinderItem,
  sceneTexts: RawBinderItem[],
  ancestors: RawBinderItem[],
  chapters: FlatChapter[],
  warnings: string[]
): void {
  const nearest =
    ancestors.length > 0 ? ancestors[ancestors.length - 1]! : null
  const parentTitle = nearest ? nearest.title : null
  if (ancestors.length > 1) {
    const dropped = ancestors
      .slice(0, -1)
      .map((a) => a.title)
      .join(' > ')
    warnings.push(
      `Chapter "${folder.title}" nested below "${dropped}"; parent set to "${parentTitle}" (deeper ancestors dropped).`
    )
  }
  chapters.push({
    source: folder,
    kind: 'folder',
    parentTitle,
    sceneItems: sceneTexts
  })
}
