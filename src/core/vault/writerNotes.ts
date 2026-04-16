// Horizontal-whitespace-only `[ \t]*` — greedy `\s*` would swallow the
// newline after the heading and shift our extract/inject anchor.
const WRITER_NOTES_HEADING_RE = /^## Writer's Notes[ \t]*$/m
const NEXT_H2_HEADING_RE = /^## .*$/m

/**
 * Extract the text following the `## Writer's Notes` heading up to the next
 * `## ` heading at the same level, or end-of-file. Returns an empty string if
 * the heading is missing — no recovery is attempted in that case.
 */
export function extractWriterNotes(fileContent: string): string {
  const match = WRITER_NOTES_HEADING_RE.exec(fileContent)
  if (!match) return ''
  const after = fileContent.slice(match.index + match[0].length)
  const body = after.startsWith('\n') ? after.slice(1) : after
  const nextHeading = NEXT_H2_HEADING_RE.exec(body)
  return nextHeading ? body.slice(0, nextHeading.index) : body
}

/**
 * Replace the body of the `## Writer's Notes` section in `newContent` with
 * `preservedNotes`. Assumes `newContent` contains exactly one `## Writer's
 * Notes` heading and no further `## ` headings after it (which is how this
 * brief's writers emit files).
 */
export function injectWriterNotes(
  newContent: string,
  preservedNotes: string
): string {
  const match = WRITER_NOTES_HEADING_RE.exec(newContent)
  if (!match) return newContent
  const before = newContent.slice(0, match.index + match[0].length)
  const tail = preservedNotes.length > 0 ? `\n${preservedNotes}` : '\n'
  return ensureTrailingNewline(before + tail)
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`
}
