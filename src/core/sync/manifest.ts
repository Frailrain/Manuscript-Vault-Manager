import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { SyncManifest } from '../../shared/types'
import { writeFileAtomic } from '../vault/atomic'
import { SyncError } from './errors'

const MANIFEST_RELATIVE = '_meta/manifest.json'
const CURRENT_VERSION = 1

export function manifestPath(vaultPath: string): string {
  return join(vaultPath, MANIFEST_RELATIVE)
}

export async function readManifest(
  vaultPath: string
): Promise<SyncManifest | null> {
  const path = manifestPath(vaultPath)
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new SyncError(
      `Failed to read manifest at ${path}: ${(err as Error).message}`,
      'manifest',
      err
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new SyncError(
      'Manifest is unreadable or from an incompatible version',
      'manifest',
      err
    )
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { version?: unknown }).version !== CURRENT_VERSION
  ) {
    throw new SyncError(
      'Manifest is unreadable or from an incompatible version',
      'manifest'
    )
  }
  return parsed as SyncManifest
}

export async function writeManifest(
  vaultPath: string,
  manifest: SyncManifest
): Promise<void> {
  const path = manifestPath(vaultPath)
  try {
    await mkdir(dirname(path), { recursive: true })
  } catch (err) {
    throw new SyncError(
      `Failed to create _meta directory: ${(err as Error).message}`,
      'manifest',
      err
    )
  }
  try {
    await writeFileAtomic(path, JSON.stringify(manifest, null, 2) + '\n')
  } catch (err) {
    throw new SyncError(
      `Failed to write manifest: ${(err as Error).message}`,
      'manifest',
      err
    )
  }
}
