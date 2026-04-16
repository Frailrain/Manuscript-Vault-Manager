/**
 * Remove leading `## `/`### `/etc. markers from an LLM-generated string so it
 * cannot accidentally introduce a section-level heading inside a managed
 * section body. The `## Writer's Notes` heading is the file's only
 * structural anchor; a rogue heading inside a summary would break parsing.
 */
export function stripHeadingMarkers(text: string): string {
  return text.replace(/^##+ /gm, '')
}
