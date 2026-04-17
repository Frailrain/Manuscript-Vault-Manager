import { basenameOf } from './filenames'

export interface NameResolver {
  resolve(name: string): string | undefined
}

export function normalizeName(s: string): string {
  return s.trim().toLowerCase()
}

export function buildNameResolver<T extends { name: string; aliases?: string[] }>(
  entities: T[]
): NameResolver {
  const map = new Map<string, string>()
  for (const e of entities) {
    const canonical = e.name
    map.set(normalizeName(canonical), canonical)
    for (const alias of e.aliases ?? []) {
      if (!alias) continue
      const key = normalizeName(alias)
      if (!map.has(key)) map.set(key, canonical)
    }
  }
  return {
    resolve(name: string) {
      return map.get(normalizeName(name))
    }
  }
}

/**
 * Render an entity reference as a wiki-link if it resolves against `resolver`,
 * falling back to plain text and pushing a warning when unresolved.
 */
export function renderEntityLink(
  rawName: string,
  resolver: NameResolver,
  filenameFor: (canonical: string) => string,
  context: string,
  warnings: string[]
): string {
  const canonical = resolver.resolve(rawName)
  if (!canonical) {
    warnings.push(`Unresolved reference: '${rawName}' in ${context}`)
    return rawName
  }
  const filename = filenameFor(canonical)
  return `[[${basenameOf(filename)}]]`
}

/**
 * Build a wiki-link for a character by canonical name. Filenames may include a
 * tier prefix like `Main/Elara`; the wiki-link text uses the basename only so
 * Obsidian can resolve `[[Elara]]` regardless of which tier folder holds it.
 */
export function characterWikiLink(
  canonicalName: string,
  filenames: Map<string, string>
): string {
  const fullPath = filenames.get(canonicalName)
  if (!fullPath) return canonicalName
  return `[[${basenameOf(fullPath)}]]`
}

/**
 * Build a wiki-link for a location by canonical name. Filenames may include a
 * parent-chain prefix like `Ganston's Crossing/Defensive Line`; the wiki-link
 * text uses the basename only.
 */
export function locationWikiLink(
  canonicalName: string,
  filenames: Map<string, string>
): string {
  const fullPath = filenames.get(canonicalName)
  if (!fullPath) return canonicalName
  return `[[${basenameOf(fullPath)}]]`
}

/**
 * Chapter links always go through the order → filename map. Filename is the
 * canonical chapter basename (without `.md`). Missing orders fall back to a
 * plain `Chapter N` mention.
 */
export function chapterWikiLink(
  order: number,
  chaptersByOrder: Map<number, string>
): string {
  const filename = chaptersByOrder.get(order)
  return filename ? `[[${filename}]]` : `Chapter ${order}`
}
