export interface AppInfo {
  name: 'Manuscript Vault Manager'
  shorthand: 'mvm'
  version: string
}

export interface ScrivenerScene {
  uuid: string
  title: string
  order: number
  content: string
  wordCount: number
  contentHash: string
  synopsis: string | null
  label: string | null
  status: string | null
}

export interface ScrivenerChapter {
  uuid: string
  title: string
  order: number
  parentTitle: string | null
  scenes: ScrivenerScene[]
  synopsis: string | null
  label: string | null
  status: string | null
}

export interface ScrivenerProject {
  projectPath: string
  projectName: string
  parsedAt: string
  chapters: ScrivenerChapter[]
  warnings: string[]
}

declare global {
  interface Window {
    mvm: {
      scrivener: { parse: (path: string) => Promise<ScrivenerProject> }
      extraction: { run: (payload: unknown) => Promise<unknown> }
      vault: { generate: (payload: unknown) => Promise<unknown> }
      sync: { check: (payload: unknown) => Promise<unknown> }
      settings: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<unknown>
      }
    }
  }
}

export {}
