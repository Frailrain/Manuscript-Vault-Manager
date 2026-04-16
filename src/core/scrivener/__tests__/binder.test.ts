import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { flattenDraft } from '../binder'
import { parseScrivenerProject } from '../parser'
import type { RawBinderItem } from '../scrivx'

function folder(
  uuid: string,
  title: string,
  children: RawBinderItem[] = []
): RawBinderItem {
  return {
    uuid,
    type: 'Folder',
    title,
    includeInCompile: true,
    labelValue: null,
    statusValue: null,
    children
  }
}

function text(
  uuid: string,
  title: string,
  opts: { includeInCompile?: boolean } = {}
): RawBinderItem {
  return {
    uuid,
    type: 'Text',
    title,
    includeInCompile: opts.includeInCompile ?? true,
    labelValue: null,
    statusValue: null,
    children: []
  }
}

function draft(children: RawBinderItem[]): RawBinderItem {
  return {
    uuid: 'DRAFT',
    type: 'DraftFolder',
    title: 'Manuscript',
    includeInCompile: true,
    labelValue: null,
    statusValue: null,
    children
  }
}

describe('flattenDraft', () => {
  it('promotes a deeply nested Text to its own chapter and warns', () => {
    const tree = draft([
      folder('F1', 'Part One', [
        folder('F2', 'Container', [
          folder('F3', 'Sub', []),
          text('T', 'Stray scene')
        ])
      ])
    ])
    const warnings: string[] = []
    const chapters = flattenDraft(tree, warnings)

    const stray = chapters.find((c) => c.source.uuid === 'T')
    expect(stray).toBeDefined()
    expect(stray!.kind).toBe('leaf-text')
    expect(stray!.parentTitle).toBe('Container')

    expect(warnings.some((w) => w.includes('Stray scene'))).toBe(true)
    expect(warnings.some((w) => w.includes('deeper ancestors dropped'))).toBe(
      true
    )
  })
})

describe('parseScrivenerProject (folder-body scenarios)', () => {
  let tmpRoot: string

  beforeAll(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'mvm-binder-'))
  })

  afterAll(async () => {
    await rm(tmpRoot, { recursive: true, force: true })
  })

  async function writeProject(
    name: string,
    scrivx: string,
    rtfEntries: Array<{ uuid: string; rtf: string }>
  ): Promise<string> {
    const root = join(tmpRoot, `${name}.scriv`)
    await mkdir(join(root, 'Files', 'Data'), { recursive: true })
    await writeFile(join(root, `${name}.scrivx`), scrivx, 'utf8')
    for (const entry of rtfEntries) {
      await mkdir(join(root, 'Files', 'Data', entry.uuid), { recursive: true })
      await writeFile(
        join(root, 'Files', 'Data', entry.uuid, 'content.rtf'),
        entry.rtf,
        'utf8'
      )
    }
    return root
  }

  it('emits scene 0 "(Chapter intro)" for an empty Folder whose body RTF is non-empty', async () => {
    const scrivx = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject Version="2.0">
  <Binder>
    <BinderItem UUID="DRAFT" Type="DraftFolder">
      <Title>Manuscript</Title>
      <Children>
        <BinderItem UUID="EMPTY-FOLDER" Type="Folder">
          <Title>Interlude</Title>
        </BinderItem>
      </Children>
    </BinderItem>
  </Binder>
</ScrivenerProject>`
    const rtf = '{\\rtf1\\ansi The clock struck midnight.\\par}'
    const root = await writeProject('with-body', scrivx, [
      { uuid: 'EMPTY-FOLDER', rtf }
    ])

    const project = await parseScrivenerProject(root)
    expect(project.chapters).toHaveLength(1)
    const chapter = project.chapters[0]!
    expect(chapter.scenes).toHaveLength(1)
    const scene = chapter.scenes[0]!
    expect(scene.order).toBe(0)
    expect(scene.title).toBe('(Chapter intro)')
    expect(scene.content).toBe('The clock struck midnight.')
  })

  it('emits a chapter with 0 scenes and no warning for an empty Folder with no body', async () => {
    const scrivx = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject Version="2.0">
  <Binder>
    <BinderItem UUID="DRAFT" Type="DraftFolder">
      <Title>Manuscript</Title>
      <Children>
        <BinderItem UUID="HOLLOW" Type="Folder">
          <Title>Reserved</Title>
        </BinderItem>
      </Children>
    </BinderItem>
  </Binder>
</ScrivenerProject>`
    const root = await writeProject('no-body', scrivx, [])
    const project = await parseScrivenerProject(root)

    expect(project.chapters).toHaveLength(1)
    const chapter = project.chapters[0]!
    expect(chapter.scenes).toHaveLength(0)
    expect(project.warnings.some((w) => w.includes('deeper ancestors'))).toBe(
      false
    )
  })
})
