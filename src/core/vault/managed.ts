export const MANAGED_BLOCK_START = '<!-- MVM:MANAGED:start -->'
export const MANAGED_BLOCK_END = '<!-- MVM:MANAGED:end -->'

export function managedBlock(content: string): string {
  return `${MANAGED_BLOCK_START}\n${content}\n${MANAGED_BLOCK_END}`
}
