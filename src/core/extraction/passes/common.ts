import type { ScrivenerChapter } from '../../../shared/types'
import type { JSONSchema } from '../providers'

export interface ExtractionContext {
  projectName: string
  priorCharacters: Array<{ name: string; aliases: string[]; role: string }>
  priorCharactersDetailed: Array<{
    name: string
    aliases: string[]
    description: string
    role: string
  }>
  priorLocations: Array<{ name: string; description: string }>
  priorChapterSummaries: Array<{
    order: number
    title: string
    summary: string
  }>
  priorChapterHeadlines: Array<{ order: number; title: string }>
  currentChapterOrder: number
  totalChapters: number
}

export interface PassRunner<T> {
  name: 'characters' | 'locations' | 'timeline' | 'continuity'
  buildPrompts(
    chapter: ScrivenerChapter,
    ctx: ExtractionContext
  ): { systemPrompt: string; userPrompt: string }
  toolName: string
  toolDescription: string
  schema: JSONSchema
  validate(data: unknown): T
}

export const SCENE_BREAK = '\n\n---SCENE BREAK---\n\n'

export function concatenateScenes(chapter: ScrivenerChapter): string {
  return chapter.scenes
    .map((scene) => scene.content.trim())
    .filter((c) => c.length > 0)
    .join(SCENE_BREAK)
}

export function formatChapterHeader(
  chapter: ScrivenerChapter,
  ctx: ExtractionContext
): string {
  const lines = [
    `Novel: ${ctx.projectName}`,
    `Chapter ${ctx.currentChapterOrder}/${ctx.totalChapters}: ${chapter.title}`
  ]
  if (chapter.parentTitle) lines.push(`Part: ${chapter.parentTitle}`)
  return lines.join('\n')
}

export function priorSummariesBlock(ctx: ExtractionContext): string {
  if (ctx.priorChapterSummaries.length === 0) return 'None yet'
  const recent = ctx.priorChapterSummaries
    .map((s) => `- Ch ${s.order} (${s.title}): ${s.summary}`)
    .join('\n')
  if (ctx.priorChapterHeadlines.length === 0) return recent
  const older = ctx.priorChapterHeadlines
    .map((h) => `- Ch ${h.order}: ${h.title}`)
    .join('\n')
  return `${older}\n\nRecent (with summaries):\n${recent}`
}

export function priorCharactersBlock(ctx: ExtractionContext): string {
  if (ctx.priorCharacters.length === 0) return 'None yet'
  return JSON.stringify(ctx.priorCharacters, null, 2)
}

export function priorCharactersDetailedBlock(ctx: ExtractionContext): string {
  if (ctx.priorCharactersDetailed.length === 0) return 'None yet'
  return JSON.stringify(ctx.priorCharactersDetailed, null, 2)
}

export function priorLocationsBlock(ctx: ExtractionContext): string {
  if (ctx.priorLocations.length === 0) return 'None yet'
  return JSON.stringify(ctx.priorLocations, null, 2)
}

export function ensureObject(data: unknown, label: string): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError(`${label}: expected object, got ${typeof data}`)
  }
  return data as Record<string, unknown>
}

export function ensureArray<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label}: expected array, got ${typeof value}`)
  }
  return value as T[]
}

export function ensureString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${label}: expected string, got ${typeof value}`)
  }
  return value
}

export function optionalString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function ensureStringArray(value: unknown, label: string): string[] {
  const arr = ensureArray<unknown>(value, label)
  return arr.map((x, i) => ensureString(x, `${label}[${i}]`))
}
