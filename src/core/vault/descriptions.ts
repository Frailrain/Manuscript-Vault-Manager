export interface DescriptionBlock {
  chapterOrder: number
  text: string
}

const BLOCK_REGEX = /^\(Ch (\d+)\):\s*([\s\S]+?)(?=\n\n\(Ch \d+\):|$)/gm

const PRONOUN_PREFIXES =
  /^(it|its|he|his|him|she|her|hers|they|their|them)\b/i

/**
 * Parse a chapter-tagged description into its constituent blocks.
 * Returns [] if the description has no (Ch N): prefixes.
 */
export function parseChapterTaggedDescription(
  description: string
): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = []
  const re = new RegExp(BLOCK_REGEX.source, BLOCK_REGEX.flags)
  let match: RegExpExecArray | null
  while ((match = re.exec(description)) !== null) {
    const order = Number.parseInt(match[1]!, 10)
    const text = match[2]!.trim()
    blocks.push({ chapterOrder: order, text })
  }
  return blocks
}

/**
 * Synthesize a single-paragraph summary from chapter-tagged blocks.
 * Returns the input unchanged if not chapter-tagged.
 */
export function synthesizeDescription(
  description: string,
  connective: string = ', who '
): string {
  const blocks = parseChapterTaggedDescription(description)
  if (blocks.length === 0) return description
  if (blocks.length === 1) return blocks[0]!.text

  const parts = blocks.map((b, i) => {
    let t = b.text.trim()
    if (i < blocks.length - 1 && /[.!?]$/.test(t)) {
      t = t.slice(0, -1)
    }
    return t
  })
  const joined = joinWithConnective(parts, connective)

  if (joined.length > 400) return blocks[0]!.text
  return joined
}

function joinWithConnective(parts: string[], connective: string): string {
  if (parts.length === 0) return ''
  let result = parts[0]!
  for (let i = 1; i < parts.length; i++) {
    const next = parts[i]!
    if (PRONOUN_PREFIXES.test(next)) {
      result = result.replace(/[,;]$/, '') + '. ' + next
    } else {
      result += connective + lowerFirst(next)
    }
  }
  return result
}

function lowerFirst(s: string): string {
  return s.length === 0 ? s : s[0]!.toLowerCase() + s.slice(1)
}
