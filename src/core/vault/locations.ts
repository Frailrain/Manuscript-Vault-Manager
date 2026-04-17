import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { GenreFieldDef } from '../../shared/presets'
import type {
  ExtractedLocation,
  ExtractionResult,
  VaultProgress
} from '../../shared/types'
import { renderCallout } from './callouts'
import {
  parseChapterTaggedDescription,
  synthesizeDescription
} from './descriptions'
import { basenameOf, sanitizeFilename } from './filenames'
import { buildFrontmatter } from './frontmatter'
import { stripHeadingMarkers } from './sanitize'
import {
  applyCustomFieldsToFrontmatter,
  renderTrackingCallout
} from './tracking'
import { writeManagedFile } from './writeManaged'
import { chapterWikiLink } from './wikilinks'

export interface LocationWriteContext {
  locationsDir: string
  locationFilenames: Map<string, string>
  /** canonicalName -> array of canonical child names, in original order. */
  locationChildren: Map<string, string[]>
  chapterFilenames: Map<number, string>
  warnings: string[]
  onProgress?: (progress: VaultProgress) => void
  locationFields?: GenreFieldDef[]
  locationSectionLabel?: string
}

export interface LocationWriteStats {
  filesWritten: number
  filesPreserved: number
}

/**
 * For each location, resolve its ancestor path prefix by walking
 * `parentLocation` up to the root. Returns a Map of canonicalName →
 * sanitized path (relative to Locations/, no filename, no trailing slash).
 * Top-level locations map to `''` (empty prefix).
 *
 * Handles cycles by truncating at the first repeated node with a warning.
 * Handles orphan parents by dropping the broken link with a warning; the
 * child becomes top-level.
 */
export function resolveLocationChains(
  locations: ExtractedLocation[],
  warnings: string[]
): Map<string, string> {
  const byName = new Map<string, ExtractedLocation>()
  for (const loc of locations) byName.set(loc.name, loc)

  const resolved = new Map<string, string>()
  const CYCLE = Symbol('cycle')

  function walk(
    name: string,
    visiting: Set<string>
  ): string | typeof CYCLE {
    if (resolved.has(name)) return resolved.get(name)!
    const loc = byName.get(name)
    if (!loc) return ''
    const parent = loc.parentLocation
    if (!parent) {
      resolved.set(name, '')
      return ''
    }
    if (visiting.has(name)) {
      warnings.push(
        `Location parent cycle detected at '${name}' — truncating chain`
      )
      return CYCLE
    }
    if (!byName.has(parent)) {
      warnings.push(
        `Orphan parentLocation reference: '${parent}' not in extracted locations`
      )
      const orphanPath = sanitizeFilename(parent)
      resolved.set(name, orphanPath)
      return orphanPath
    }
    visiting.add(name)
    const parentChain = walk(parent, visiting)
    visiting.delete(name)

    if (parentChain === CYCLE) {
      resolved.set(name, '')
      return CYCLE
    }

    const parentSanitized = sanitizeFilename(parent)
    const ancestorPath =
      parentChain.length > 0
        ? `${parentChain}/${parentSanitized}`
        : parentSanitized

    resolved.set(name, ancestorPath)
    return ancestorPath
  }

  for (const loc of locations) walk(loc.name, new Set())
  return resolved
}

export interface LocationAllocationResult {
  filenames: Map<string, string>
  children: Map<string, string[]>
  warnings: string[]
}

/**
 * Allocate filenames for each location under its resolved parent chain.
 * Collisions are detected only within the same parent folder. Returns
 * both the filename map (canonical → `Parent/Child` path, no extension) and
 * a children index (canonical → list of canonical child names, in original
 * order) used to render Sub-locations callouts.
 */
export function allocateLocationFilenames(
  locations: ExtractedLocation[]
): LocationAllocationResult {
  const warnings: string[] = []
  const chains = resolveLocationChains(locations, warnings)
  const filenames = new Map<string, string>()
  const children = new Map<string, string[]>()
  const usedByDir = new Map<string, Set<string>>()
  const unnamedByDir = new Map<string, number>()

  for (const loc of locations) {
    const ancestorPath = chains.get(loc.name) ?? ''
    const used = usedByDir.get(ancestorPath) ?? new Set<string>()
    usedByDir.set(ancestorPath, used)

    const sanitized = sanitizeFilename(loc.name)
    let basename: string
    if (sanitized.length === 0) {
      const count = (unnamedByDir.get(ancestorPath) ?? 0) + 1
      unnamedByDir.set(ancestorPath, count)
      basename = `_unnamed_${count}`
      warnings.push(
        `Empty location name after sanitization; using fallback '${basename}' under '${ancestorPath || '(root)'}'`
      )
    } else {
      basename = sanitized
    }

    let candidate = basename
    let counter = 2
    while (used.has(candidate.toLowerCase())) {
      candidate = `${basename} (${counter})`
      counter += 1
      if (counter > 10_000) {
        throw new Error(
          `Unable to allocate unique location filename for '${loc.name}' after 10000 attempts`
        )
      }
    }
    if (candidate !== basename) {
      warnings.push(
        `Filename collision for location '${loc.name}' under '${ancestorPath || '(root)'}'; renamed to '${candidate}'`
      )
    }
    used.add(candidate.toLowerCase())
    const fullPath =
      ancestorPath.length > 0 ? `${ancestorPath}/${candidate}` : candidate
    filenames.set(loc.name, fullPath)
  }

  for (const loc of locations) {
    const parent = loc.parentLocation
    if (!parent) continue
    if (!filenames.has(parent)) continue
    const list = children.get(parent) ?? []
    list.push(loc.name)
    children.set(parent, list)
  }

  // Folder-note promotion: a location with at least one child moves into its
  // own same-named folder so Obsidian (with the Folder Notes plugin) renders
  // the folder as a landing page instead of showing a duplicate sibling file.
  for (const loc of locations) {
    const childNames = children.get(loc.name)
    if (!childNames || childNames.length === 0) continue
    const currentPath = filenames.get(loc.name)
    if (!currentPath) continue
    const segments = currentPath.split('/')
    const basename = segments[segments.length - 1]!
    filenames.set(loc.name, `${currentPath}/${basename}`)
  }

  return { filenames, children, warnings }
}

export async function writeLocations(
  extraction: ExtractionResult,
  ctx: LocationWriteContext
): Promise<LocationWriteStats> {
  const stats: LocationWriteStats = { filesWritten: 0, filesPreserved: 0 }
  await cleanupStaleParentLocationFiles(extraction, ctx)
  const total = extraction.locations.length
  for (let i = 0; i < extraction.locations.length; i++) {
    const location = extraction.locations[i]!
    const filename = ctx.locationFilenames.get(location.name)
    if (!filename) {
      throw new Error(
        `Internal error: no filename allocated for location '${location.name}'`
      )
    }
    const path = join(ctx.locationsDir, `${filename}.md`)
    ctx.onProgress?.({
      phase: 'locations',
      current: i + 1,
      total,
      currentFile: `${filename}.md`
    })
    await mkdir(dirname(path), { recursive: true })
    const content = buildLocationFile(location, ctx)
    const outcome = await writeManagedFile(path, content)
    stats.filesWritten += 1
    if (outcome.preserved) stats.filesPreserved += 1
  }
  return stats
}

/**
 * Pre-#5.4.2 vaults wrote a parent location's page as a sibling to its folder
 * (`Locations/{ancestor}/{name}.md`). Since the parent now lives inside its
 * own folder (`Locations/{ancestor}/{name}/{name}.md`), the old sibling file
 * would linger as a duplicate. Remove it. Any Writer's Notes in that old
 * file are lost — consistent with the pre-launch breakable-notes policy.
 */
async function cleanupStaleParentLocationFiles(
  extraction: ExtractionResult,
  ctx: LocationWriteContext
): Promise<void> {
  for (const loc of extraction.locations) {
    const childNames = ctx.locationChildren.get(loc.name)
    if (!childNames || childNames.length === 0) continue
    const currentPath = ctx.locationFilenames.get(loc.name)
    if (!currentPath) continue
    const segments = currentPath.split('/')
    if (segments.length < 2) continue
    const oldSiblingRel = segments.slice(0, -1).join('/')
    const oldSiblingPath = join(ctx.locationsDir, `${oldSiblingRel}.md`)
    try {
      await stat(oldSiblingPath)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') continue
      ctx.warnings.push(
        `Failed to stat stale parent location file '${oldSiblingPath}': ${(err as Error).message}`
      )
      continue
    }
    try {
      await rm(oldSiblingPath, { force: true })
      ctx.warnings.push(
        `Removed stale parent location file '${oldSiblingRel}.md'; any Writer's Notes inside were lost.`
      )
    } catch (err) {
      ctx.warnings.push(
        `Failed to remove stale parent location file '${oldSiblingPath}': ${(err as Error).message}`
      )
    }
  }
}

function buildLocationFile(
  location: ExtractedLocation,
  ctx: LocationWriteContext
): string {
  const fieldDefs = ctx.locationFields ?? []
  const fmFields: Record<string, unknown> = {
    type: 'location',
    name: location.name,
    firstAppearance: location.firstAppearanceChapter,
    appearances: [...location.appearances]
  }
  applyCustomFieldsToFrontmatter(fmFields, fieldDefs, location.customFields)

  const frontmatter = buildFrontmatter(fmFields)

  const atAGlance = renderAtAGlance(location)
  const descriptionSection = renderDescriptionSection(location.description)
  const subLocationsCallout = renderSubLocationsCallout(location, ctx)
  const appearancesSection = renderAppearancesSection(location, ctx)

  const trackingCallout = renderTrackingCallout(
    ctx.locationSectionLabel ?? '',
    fieldDefs,
    location.customFields
  )

  const lines: string[] = [
    frontmatter.trimEnd(),
    '',
    `# ${location.name}`,
    '',
    atAGlance,
    '',
    '## Description',
    '',
    descriptionSection,
    ''
  ]
  if (subLocationsCallout) {
    lines.push(subLocationsCallout, '')
  }
  if (trackingCallout) {
    lines.push(trackingCallout, '')
  }
  lines.push(
    '## Appearances',
    '',
    appearancesSection,
    '',
    "## Writer's Notes",
    ''
  )

  return lines.join('\n') + '\n'
}

function renderSubLocationsCallout(
  location: ExtractedLocation,
  ctx: LocationWriteContext
): string | null {
  const children = ctx.locationChildren.get(location.name) ?? []
  if (children.length === 0) return null
  const items = children.map((childName) => {
    const full = ctx.locationFilenames.get(childName)
    const link = full ? `[[${basenameOf(full)}]]` : childName
    return `- ${link}`
  })
  return renderCallout({
    type: 'info',
    title: 'Sub-locations',
    body: items.join('\n')
  })
}

function renderAtAGlance(location: ExtractedLocation): string {
  const bodyLines: string[] = []
  bodyLines.push(`**First seen:** Chapter ${location.firstAppearanceChapter}`)
  const appearsCount = location.appearances.length
  bodyLines.push(
    `**Appears in:** ${appearsCount} ${appearsCount === 1 ? 'chapter' : 'chapters'}`
  )
  const significance = location.significance.trim()
  if (significance.length > 0) {
    bodyLines.push(`**Significance:** ${stripHeadingMarkers(significance)}`)
  }
  return renderCallout({
    type: 'abstract',
    title: 'At a Glance',
    body: bodyLines.join('\n')
  })
}

function renderDescriptionSection(rawDescription: string): string {
  const trimmed = rawDescription.trim()
  if (trimmed.length === 0) {
    return '*(not specified)*'
  }

  const blocks = parseChapterTaggedDescription(trimmed)
  const synthesized = stripHeadingMarkers(
    synthesizeDescription(trimmed, '. It ')
  )

  if (blocks.length < 2) {
    return synthesized
  }

  const perChapterBody = blocks
    .map(
      (b) => `**Chapter ${b.chapterOrder}:** ${stripHeadingMarkers(b.text)}`
    )
    .join('\n')
  const perChapterCallout = renderCallout({
    type: 'note',
    title: 'Per-chapter detail',
    body: perChapterBody,
    foldable: true
  })

  return `${synthesized}\n\n${perChapterCallout}`
}

function renderAppearancesSection(
  location: ExtractedLocation,
  ctx: LocationWriteContext
): string {
  if (location.appearances.length === 0) return '*(none)*'
  return location.appearances
    .map((order) => `- ${chapterWikiLink(order, ctx.chapterFilenames)}`)
    .join('\n')
}
