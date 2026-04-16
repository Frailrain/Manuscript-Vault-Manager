import { resolve, basename, extname, dirname, join, isAbsolute } from 'node:path'
import { stat, readdir } from 'node:fs/promises'

import { ScrivenerParseError } from './errors'

export interface ResolvedProjectPaths {
  scrivFolder: string
  scrivxFile: string
  dataDir: string
  projectName: string
}

export async function resolveProjectPaths(input: string): Promise<ResolvedProjectPaths> {
  if (typeof input !== 'string' || input.length === 0) {
    throw new ScrivenerParseError('projectPath must be a non-empty string')
  }

  const absolute = isAbsolute(input) ? input : resolve(process.cwd(), input)

  let existence
  try {
    existence = await stat(absolute)
  } catch {
    throw new ScrivenerParseError(`Scrivener project not found at ${absolute}`)
  }

  let scrivFolder: string
  let scrivxFile: string

  if (existence.isFile() && extname(absolute).toLowerCase() === '.scrivx') {
    scrivxFile = absolute
    scrivFolder = dirname(absolute)
  } else if (existence.isDirectory()) {
    scrivFolder = absolute
    scrivxFile = await findScrivxInFolder(scrivFolder)
  } else {
    throw new ScrivenerParseError(
      `Expected a .scriv folder or .scrivx file, got ${absolute}`
    )
  }

  if (extname(scrivFolder).toLowerCase() !== '.scriv') {
    // Tolerate: some users may pass the folder even if it's not suffixed .scriv
    // (e.g. unzipped projects). We don't hard-fail, but callers rely on a .scriv
    // directory — keep the folder as-is and derive project name from scrivx.
  }

  const projectName = basename(scrivxFile, extname(scrivxFile))
  const dataDir = join(scrivFolder, 'Files', 'Data')

  return { scrivFolder, scrivxFile, dataDir, projectName }
}

async function findScrivxInFolder(folder: string): Promise<string> {
  let entries: string[]
  try {
    entries = await readdir(folder)
  } catch {
    throw new ScrivenerParseError(`Cannot read Scrivener project folder ${folder}`)
  }
  const matches = entries.filter((name) => extname(name).toLowerCase() === '.scrivx')
  if (matches.length === 0) {
    throw new ScrivenerParseError(`No .scrivx file found inside ${folder}`)
  }
  if (matches.length > 1) {
    const preferred = matches.find(
      (m) => basename(m, extname(m)) === basename(folder, extname(folder))
    )
    return join(folder, preferred ?? matches[0]!)
  }
  return join(folder, matches[0]!)
}

export function contentRtfPath(dataDir: string, uuid: string): string {
  return join(dataDir, uuid, 'content.rtf')
}

export function synopsisPath(dataDir: string, uuid: string): string {
  return join(dataDir, uuid, 'synopsis.txt')
}
