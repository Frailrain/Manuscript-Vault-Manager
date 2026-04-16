import { XMLParser } from 'fast-xml-parser'

import { ScrivenerParseError } from './errors'

export type BinderItemType =
  | 'DraftFolder'
  | 'Folder'
  | 'Text'
  | 'ResearchFolder'
  | 'TrashFolder'
  | 'Other'
  | string

export interface RawBinderItem {
  uuid: string
  type: BinderItemType
  title: string
  includeInCompile: boolean
  labelValue: string | null
  statusValue: string | null
  children: RawBinderItem[]
}

export interface ParsedScrivx {
  binderItems: RawBinderItem[]
  labels: Map<string, string>
  statuses: Map<string, string>
  version: string | null
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  isArray: (name, jpath) => {
    const path = typeof jpath === 'string' ? jpath : ''
    if (name === 'BinderItem') return true
    if (name === 'Label' && path.endsWith('LabelSettings.Label')) return true
    if (name === 'Status' && path.endsWith('StatusSettings.Status')) return true
    return false
  }
})

export function parseScrivx(xml: string): ParsedScrivx {
  let doc: Record<string, unknown>
  try {
    doc = parser.parse(xml) as Record<string, unknown>
  } catch (err) {
    throw new ScrivenerParseError('Failed to parse .scrivx XML', err)
  }

  const root = doc['ScrivenerProject'] as Record<string, unknown> | undefined
  if (!root || typeof root !== 'object') {
    throw new ScrivenerParseError(
      'Malformed .scrivx: missing <ScrivenerProject> root element'
    )
  }

  const version = asString(root['@_Version'])

  const binder = root['Binder'] as Record<string, unknown> | undefined
  if (!binder) {
    throw new ScrivenerParseError('Malformed .scrivx: missing <Binder> element')
  }

  const rawItems = asArray(binder['BinderItem'])
  const binderItems = rawItems.map(toRawBinderItem)

  const labels = extractSettings(root, 'LabelSettings', 'Label')
  const statuses = extractSettings(root, 'StatusSettings', 'Status')

  return { binderItems, labels, statuses, version }
}

function toRawBinderItem(node: Record<string, unknown>): RawBinderItem {
  const uuid = asString(node['@_UUID']) ?? ''
  const type = (asString(node['@_Type']) ?? 'Other') as BinderItemType
  const title = asString(node['Title']) ?? ''

  let includeInCompile = true
  let labelValue: string | null = null
  let statusValue: string | null = null

  const metadata = node['MetaData'] as Record<string, unknown> | undefined
  if (metadata) {
    const incl = asString(metadata['IncludeInCompile'])
    if (incl !== null && incl.toLowerCase() === 'no') includeInCompile = false
    labelValue = asString(metadata['Label'])
    statusValue = asString(metadata['Status'])
  }

  const childrenNode = node['Children'] as Record<string, unknown> | undefined
  const childArray = childrenNode
    ? asArray(childrenNode['BinderItem'])
    : []
  const children = childArray.map(toRawBinderItem)

  return { uuid, type, title, includeInCompile, labelValue, statusValue, children }
}

function extractSettings(
  root: Record<string, unknown>,
  settingsKey: string,
  entryKey: string
): Map<string, string> {
  const map = new Map<string, string>()
  const settingsNode = findNodeDeep(root, settingsKey)
  if (!settingsNode) return map

  const entries = asArray(settingsNode[entryKey])
  for (const entry of entries) {
    const id = asString(entry['@_ID'])
    const name = asString(entry['#text']) ?? asString(entry['Title'])
    if (id && name) map.set(id, name)
  }
  return map
}

function findNodeDeep(
  obj: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  if (obj[key] && typeof obj[key] === 'object') {
    return obj[key] as Record<string, unknown>
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const found = findNodeDeep(value as Record<string, unknown>, key)
      if (found) return found
    }
  }
  return null
}

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    const text = (value as Record<string, unknown>)['#text']
    return typeof text === 'string' ? text : null
  }
  return null
}

function asArray<T = Record<string, unknown>>(value: unknown): T[] {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) return value as T[]
  return [value as T]
}

export function findDraftFolder(items: RawBinderItem[]): RawBinderItem | null {
  for (const item of items) {
    if (item.type === 'DraftFolder') return item
  }
  return null
}

// Label/Status resolution: Scrivener stores these as either inline display
// strings or numeric IDs that reference entries under ProjectSettings →
// Label/StatusSettings. We support both transparently — if the raw value keys
// into the settings map, we resolve it to the display name; otherwise the raw
// value is passed through unchanged. Brief #1 permits either strategy; this
// "resolve-when-possible" behaviour keeps output human-readable without hard-
// failing on projects whose settings tables we can't locate.
export function resolveLabel(
  raw: string | null,
  map: Map<string, string>
): string | null {
  if (raw === null || raw === '') return null
  return map.get(raw) ?? raw
}
