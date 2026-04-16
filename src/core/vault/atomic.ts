import { rename, unlink, writeFile } from 'node:fs/promises'

import { VaultGenerationError } from './errors'

/**
 * Write a file atomically by writing to a sibling `.tmp` file first and then
 * renaming it into place. The rename is atomic on POSIX filesystems, so a
 * crash mid-write leaves either the old content or the new — never a partial
 * file.
 */
export async function writeFileAtomic(
  path: string,
  content: string
): Promise<void> {
  const tmp = `${path}.tmp`
  try {
    await writeFile(tmp, content, 'utf8')
  } catch (err) {
    throw new VaultGenerationError(
      `Failed to write temporary file for ${path}: ${(err as Error).message}`,
      'write',
      err
    )
  }
  try {
    await rename(tmp, path)
  } catch (err) {
    await unlink(tmp).catch(() => undefined)
    throw new VaultGenerationError(
      `Failed to rename temporary file into ${path}: ${(err as Error).message}`,
      'write',
      err
    )
  }
}
