import type { GenreFieldDef } from '../../shared/presets'
import type { CustomFieldValue } from '../../shared/types'
import { renderCallout } from './callouts'
import { sanitizeLLMText, stripHeadingMarkers } from './sanitize'

const RESERVED_FRONTMATTER_KEYS = new Set([
  'type',
  'name',
  'aliases',
  'role',
  'firstAppearance',
  'appearances'
])

/**
 * Render the Tracking callout body for a character or location. Returns
 * `null` when there is no callout to render (no fields configured, or no
 * extracted values for any of the configured fields).
 */
export function renderTrackingCallout(
  title: string,
  fieldDefs: GenreFieldDef[],
  values: Record<string, CustomFieldValue>
): string | null {
  if (!title || fieldDefs.length === 0) return null
  const bodyLines: string[] = []
  for (const def of fieldDefs) {
    const raw = values[def.key]
    const rendered = renderFieldLines(def, raw)
    if (rendered === null) continue
    bodyLines.push(...rendered)
  }
  if (bodyLines.length === 0) return null
  return renderCallout({
    type: 'info',
    title,
    body: bodyLines.join('\n')
  })
}

function renderFieldLines(
  def: GenreFieldDef,
  value: CustomFieldValue | undefined
): string[] | null {
  if (value === undefined || value === null) return null
  const label = stripHeadingMarkers(def.label)
  if (def.type === 'list') {
    if (!Array.isArray(value) || value.length === 0) return null
    const items = value
      .map((v) => (typeof v === 'string' ? sanitizeLLMText(v) : ''))
      .filter((v) => v.length > 0)
    if (items.length === 0) return null
    return [`**${label}:**`, ...items.map((item) => `- ${item}`)]
  }
  if (def.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    return [`**${label}:** ${String(value)}`]
  }
  if (typeof value !== 'string' || value.trim().length === 0) return null
  return [`**${label}:** ${sanitizeLLMText(value.trim())}`]
}

/**
 * Fold the configured custom-field values into a frontmatter dictionary.
 * When a field key collides with a reserved MVM frontmatter key, the
 * field is emitted under `custom-<key>` instead.
 */
export function applyCustomFieldsToFrontmatter(
  target: Record<string, unknown>,
  fieldDefs: GenreFieldDef[],
  values: Record<string, CustomFieldValue>
): void {
  for (const def of fieldDefs) {
    const raw = values[def.key]
    if (raw === undefined || raw === null) continue
    if (def.type === 'list') {
      if (!Array.isArray(raw) || raw.length === 0) continue
      target[frontmatterKey(def.key)] = raw.slice()
    } else if (def.type === 'number') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
      target[frontmatterKey(def.key)] = raw
    } else {
      if (typeof raw !== 'string' || raw.trim().length === 0) continue
      target[frontmatterKey(def.key)] = raw.trim()
    }
  }
}

function frontmatterKey(key: string): string {
  return RESERVED_FRONTMATTER_KEYS.has(key) ? `custom-${key}` : key
}
