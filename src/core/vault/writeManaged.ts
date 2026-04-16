import { readFile } from 'node:fs/promises'

import { writeFileAtomic } from './atomic'
import { extractWriterNotes, injectWriterNotes } from './writerNotes'

export interface ManagedWriteOutcome {
  /** True when the existing file had non-empty Writer's Notes that were merged in. */
  preserved: boolean
}

/**
 * Write a file that contains a `## Writer's Notes` section which must survive
 * regenerations. The `newContent` must already include an (empty) Writer's
 * Notes section — this helper fills it with text from any existing file at the
 * same path.
 */
export async function writeManagedFile(
  path: string,
  newContent: string
): Promise<ManagedWriteOutcome> {
  let existing: string | null = null
  try {
    existing = await readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }

  let preserved = false
  let finalContent = newContent
  if (existing !== null) {
    const notes = extractWriterNotes(existing)
    finalContent = injectWriterNotes(newContent, notes)
    preserved = notes.trim().length > 0
  }

  await writeFileAtomic(path, finalContent)
  return { preserved }
}
