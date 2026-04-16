/**
 * Hand-rolled YAML frontmatter builder covering only the value shapes we emit:
 * strings, numbers, booleans, string arrays, number arrays. Null/undefined
 * fields are dropped rather than rendered as `key: null`.
 */
export function buildFrontmatter(fields: Record<string, unknown>): string {
  const lines: string[] = ['---']
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue
    lines.push(`${key}: ${renderValue(value)}`)
  }
  lines.push('---', '')
  return lines.join('\n') + '\n'
}

function renderValue(value: unknown): string {
  if (typeof value === 'string') return quoteString(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot render non-finite number in frontmatter: ${value}`)
    }
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) return renderArray(value)
  throw new Error(
    `Unsupported frontmatter value type: ${typeof value} (${String(value)})`
  )
}

function renderArray(value: unknown[]): string {
  if (value.length === 0) return '[]'
  if (value.every((v) => typeof v === 'string')) {
    const parts = value.map((v) => quoteString(v as string))
    return `[ ${parts.join(', ')} ]`
  }
  if (value.every((v) => typeof v === 'number')) {
    return `[${value.join(', ')}]`
  }
  throw new Error('Frontmatter arrays must be all-string or all-number')
}

function quoteString(s: string): string {
  const escaped = s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}"`
}
