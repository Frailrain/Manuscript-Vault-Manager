export type CalloutType =
  | 'note'
  | 'info'
  | 'abstract'
  | 'example'
  | 'warning'
  | 'danger'
  | 'caution'
  | 'tip'
  | 'success'

export interface CalloutOptions {
  type: CalloutType
  title?: string
  body: string
  foldable?: boolean
}

export function renderCallout(opts: CalloutOptions): string {
  const lines = opts.body.split('\n')
  for (const line of lines) {
    if (/^\s*> \[!/.test(line)) {
      throw new Error('Nested callouts not supported')
    }
  }

  const typeTag = opts.foldable ? `${opts.type}-` : opts.type
  const header = opts.title
    ? `> [!${typeTag}] ${opts.title}`
    : `> [!${typeTag}]`
  const body = lines
    .map((line) => (line.length === 0 ? '>' : `> ${line}`))
    .join('\n')
  return `${header}\n${body}`
}
