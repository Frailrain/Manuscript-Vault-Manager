import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { parseUserOverrides, readUserOverrides } from '../userOverrides'

describe('parseUserOverrides', () => {
  it('returns empty object for empty input', () => {
    expect(parseUserOverrides('')).toEqual({})
  })

  it('returns empty object for content without frontmatter', () => {
    expect(parseUserOverrides('# Amber\n\nSome body text.\n')).toEqual({})
  })

  it('picks up an unquoted user-tier', () => {
    const content = '---\ntype: "character"\nuser-tier: main\n---\n# Amber\n'
    expect(parseUserOverrides(content)).toEqual({ tier: 'main' })
  })

  it('picks up a quoted user-tier', () => {
    const content = '---\ntype: "character"\nuser-tier: "main"\n---\n# Amber\n'
    expect(parseUserOverrides(content)).toEqual({ tier: 'main' })
  })

  it('ignores an invalid user-tier value', () => {
    const content = '---\nuser-tier: foo\n---\n'
    expect(parseUserOverrides(content)).toEqual({})
  })

  it('picks up a quoted user-role with spaces', () => {
    const content =
      '---\nuser-role: "party healer and romantic lead"\n---\n'
    expect(parseUserOverrides(content)).toEqual({
      role: 'party healer and romantic lead'
    })
  })

  it('returns both overrides when both keys are present', () => {
    const content =
      '---\ntype: "character"\nuser-tier: "main"\nuser-role: "party healer"\n---\n'
    expect(parseUserOverrides(content)).toEqual({
      tier: 'main',
      role: 'party healer'
    })
  })

  it('ignores an empty user-role', () => {
    const content = '---\nuser-role: ""\n---\n'
    expect(parseUserOverrides(content)).toEqual({})
  })
})

describe('readUserOverrides', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mvm-userOverrides-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns empty object when the file does not exist', async () => {
    const path = join(dir, 'missing.md')
    await expect(readUserOverrides(path)).resolves.toEqual({})
  })

  it('reads overrides from an on-disk file', async () => {
    const path = join(dir, 'Amber.md')
    await writeFile(
      path,
      '---\ntype: "character"\nuser-tier: "main"\n---\n# Amber\n',
      'utf8'
    )
    await expect(readUserOverrides(path)).resolves.toEqual({ tier: 'main' })
  })
})
