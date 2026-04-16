// Hand-rolled RTF → plain text extractor (Option A from Brief #1).
//
// The popular RTF libraries on npm are either abandoned (`rtf-parser`), niched
// for Outlook (`rtf-stream-parser`), or brand-new with little adoption. Scrivener
// emits a well-behaved subset of RTF — pure body text wrapped in font/colour
// tables, standard \par paragraph breaks, \'XX hex escapes and \uNNNN unicode
// escapes — so a ~100-line state machine covers it without pulling a dependency.
// If we ever encounter tables, footnotes, or embedded images in user projects
// we can swap this for a library; the public API is `rtfToPlainText(rtf: string)`.

const IGNORABLE_DESTINATIONS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'pict',
  'object',
  'field',
  'footnote',
  'annotation',
  'atrfstart',
  'atrfend',
  'comment',
  'header',
  'headerl',
  'headerr',
  'headerf',
  'footer',
  'footerl',
  'footerr',
  'footerf',
  'listtable',
  'listoverridetable',
  'revtbl',
  'rsidtbl',
  'generator',
  'themedata',
  'datastore',
  'filetbl',
  'xmlnstbl',
  'latentstyles',
  'datafield',
  'formfield'
])

const decoderCache = new Map<number, InstanceType<typeof TextDecoder>>()

function decoderFor(codepage: number): InstanceType<typeof TextDecoder> {
  let d = decoderCache.get(codepage)
  if (!d) {
    try {
      d = new TextDecoder(`windows-${codepage}`)
    } catch {
      d = new TextDecoder('windows-1252')
    }
    decoderCache.set(codepage, d)
  }
  return d
}

function decodeByte(byte: number, codepage: number): string {
  return decoderFor(codepage).decode(new Uint8Array([byte]))
}

export function rtfToPlainText(rtf: string): string {
  if (typeof rtf !== 'string' || rtf.length === 0) return ''

  const out: string[] = []
  const stack: Array<{ skip: boolean; uc: number }> = [{ skip: false, uc: 1 }]
  let atGroupStart = false
  let codepage = 1252
  let pendingUcSkip = 0
  let i = 0
  const n = rtf.length

  const top = (): { skip: boolean; uc: number } => stack[stack.length - 1]!
  const suppressed = (): boolean => top().skip

  const consumeOne = (): boolean => {
    if (pendingUcSkip > 0) {
      pendingUcSkip--
      return true
    }
    return false
  }

  while (i < n) {
    const c = rtf[i]!

    if (c === '{') {
      const parent = top()
      stack.push({ skip: parent.skip, uc: parent.uc })
      atGroupStart = true
      i++
      continue
    }

    if (c === '}') {
      if (stack.length > 1) stack.pop()
      atGroupStart = false
      i++
      continue
    }

    if (c === '\\') {
      const next = rtf[i + 1]
      if (next === undefined) {
        i++
        continue
      }

      if (next === '\\' || next === '{' || next === '}') {
        if (!consumeOne() && !suppressed()) out.push(next)
        atGroupStart = false
        i += 2
        continue
      }

      if (next === '*') {
        top().skip = true
        atGroupStart = false
        i += 2
        continue
      }

      if (next === "'") {
        const hex = rtf.substr(i + 2, 2)
        i += 4
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          if (!consumeOne() && !suppressed()) {
            out.push(decodeByte(parseInt(hex, 16), codepage))
          }
        }
        atGroupStart = false
        continue
      }

      if (next === '~') {
        if (!consumeOne() && !suppressed()) out.push('\u00a0')
        atGroupStart = false
        i += 2
        continue
      }

      if (next === '-') {
        // Optional hyphen — strip.
        atGroupStart = false
        i += 2
        continue
      }

      if (next === '_') {
        if (!consumeOne() && !suppressed()) out.push('-')
        atGroupStart = false
        i += 2
        continue
      }

      if (next === '\n' || next === '\r') {
        if (!consumeOne() && !suppressed()) out.push('\n\n')
        atGroupStart = false
        i += 2
        continue
      }

      if (/[a-zA-Z]/.test(next)) {
        const match = /^\\([a-zA-Z]+)(-?\d+)?[ ]?/.exec(rtf.slice(i))
        if (!match) {
          i++
          continue
        }
        const word = match[1]!
        const arg = match[2] !== undefined ? parseInt(match[2], 10) : null
        i += match[0].length

        if (atGroupStart && IGNORABLE_DESTINATIONS.has(word)) {
          top().skip = true
        }
        atGroupStart = false

        if (word === 'ansicpg' && arg !== null) {
          codepage = arg
          continue
        }
        if (word === 'par') {
          if (!consumeOne() && !suppressed()) out.push('\n\n')
          continue
        }
        if (word === 'line') {
          if (!consumeOne() && !suppressed()) out.push('\n')
          continue
        }
        if (word === 'tab') {
          if (!consumeOne() && !suppressed()) out.push('\t')
          continue
        }
        if (word === 'u' && arg !== null) {
          if (!consumeOne() && !suppressed()) {
            const cp = arg < 0 ? arg + 65536 : arg
            try {
              out.push(String.fromCodePoint(cp))
            } catch {
              out.push('?')
            }
          }
          pendingUcSkip = top().uc
          continue
        }
        if (word === 'uc' && arg !== null) {
          top().uc = arg
          continue
        }
        if (word === 'emdash') {
          if (!consumeOne() && !suppressed()) out.push('\u2014')
          continue
        }
        if (word === 'endash') {
          if (!consumeOne() && !suppressed()) out.push('\u2013')
          continue
        }
        if (word === 'lquote') {
          if (!consumeOne() && !suppressed()) out.push('\u2018')
          continue
        }
        if (word === 'rquote') {
          if (!consumeOne() && !suppressed()) out.push('\u2019')
          continue
        }
        if (word === 'ldblquote') {
          if (!consumeOne() && !suppressed()) out.push('\u201c')
          continue
        }
        if (word === 'rdblquote') {
          if (!consumeOne() && !suppressed()) out.push('\u201d')
          continue
        }
        if (word === 'bullet') {
          if (!consumeOne() && !suppressed()) out.push('\u2022')
          continue
        }

        // Unhandled control word — purely formatting, but counts as one "char"
        // for a pending \uc fallback skip.
        consumeOne()
        continue
      }

      // Unknown backslash-symbol: drop it.
      atGroupStart = false
      i += 2
      continue
    }

    if (c === '\n' || c === '\r') {
      // Raw file newline between tokens — not part of the logical text.
      i++
      continue
    }

    if (!consumeOne() && !suppressed()) out.push(c)
    atGroupStart = false
    i++
  }

  return normalize(out.join(''))
}

function normalize(raw: string): string {
  const unified = raw.replace(/\r\n?/g, '\n')
  const trimmed = unified
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
  const collapsed = trimmed.replace(/\n{3,}/g, '\n\n')
  return collapsed.replace(/^\n+/, '').replace(/\n+$/, '')
}

export function countWords(text: string): number {
  const matches = text.match(/\S+/g)
  return matches ? matches.length : 0
}
