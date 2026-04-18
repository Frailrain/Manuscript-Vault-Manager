/**
 * Remove leading `## `/`### `/etc. markers from an LLM-generated string so it
 * cannot accidentally introduce a section-level heading inside a managed
 * section body. The `## Writer's Notes` heading is the file's only
 * structural anchor; a rogue heading inside a summary would break parsing.
 */
export function stripHeadingMarkers(text: string): string {
  return text.replace(/^##+ /gm, '')
}

/**
 * Escape characters in LLM-sourced text that would otherwise collide with
 * markdown / CommonMark syntax and potentially break rendering (especially
 * inside Obsidian callouts). Preserves wiki-links `[[...]]` unchanged.
 *
 * Known culprits addressed:
 * - `<...>` notation common in LitRPG (System titles, tags) — interpreted as
 *   HTML tags / autolinks, breaks enclosing callouts.
 * - Single `[`/`]` — ambiguous with link/reference syntax.
 * - Backticks — start inline code blocks.
 * - Backslash — must be escaped first to avoid doubling.
 *
 * Left unescaped: `#` (handled separately by stripHeadingMarkers), `*` and
 * `_` (writer intent), wiki-link `[[...]]` pairs.
 */
export function escapeMarkdownInline(text: string): string {
  if (text.length === 0) return text

  let result = text.replace(/\\/g, '\\\\')

  const WIKILINK_RE = /\[\[[^\]\n]+?\]\]/g
  const wikilinks: string[] = []
  result = result.replace(WIKILINK_RE, (m) => {
    const idx = wikilinks.length
    wikilinks.push(m)
    return `\u0000WIKILINK${idx}\u0000`
  })

  result = result.replace(/\[/g, '\\[')
  result = result.replace(/\]/g, '\\]')

  result = result.replace(/\u0000WIKILINK(\d+)\u0000/g, (_m, n) => {
    return wikilinks[Number(n)]!
  })

  result = result.replace(/</g, '\\<')
  result = result.replace(/>/g, '\\>')
  result = result.replace(/`/g, '\\`')

  return result
}

/**
 * Standard sanitization for LLM-sourced text appearing inside rendered
 * content. Strips heading markers first (structural), then escapes inline
 * markdown that could break parsing.
 */
export function sanitizeLLMText(text: string): string {
  return escapeMarkdownInline(stripHeadingMarkers(text))
}
