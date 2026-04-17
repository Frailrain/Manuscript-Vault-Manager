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

  const base = `> [!${opts.type}]`
  const suffix = opts.foldable ? '-' : ''
  const header = opts.title
    ? `${base}${suffix} ${opts.title}`
    : `${base}${suffix}`
  const body = lines
    .map((line) => (line.length === 0 ? '>' : `> ${line}`))
    .join('\n')
  return `${header}\n${body}`
}
