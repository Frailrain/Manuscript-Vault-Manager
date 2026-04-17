import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// electron-conf requires `electron` at the top level, which Vitest can't
// resolve cleanly. Replace it with a minimal JSON-backed stand-in so the
// settings wrapper's get/set logic is exercised against real disk state.
vi.mock('electron-conf', () => {
  class Conf<T extends Record<string, unknown>> {
    private path: string
    private data: T
    constructor(options: {
      name: string
      defaults: T
      dir?: string
      ext?: string
    }) {
      const dir = options.dir ?? tmpdir()
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      this.path = join(dir, `${options.name}${options.ext ?? '.json'}`)
      if (existsSync(this.path)) {
        this.data = { ...options.defaults, ...JSON.parse(readFileSync(this.path, 'utf8')) }
      } else {
        this.data = { ...options.defaults }
      }
    }
    get(key: keyof T): T[keyof T] {
      return this.data[key]
    }
    set(key: keyof T, value: T[keyof T]): void {
      this.data[key] = value
      mkdirSync(dirname(this.path), { recursive: true })
      writeFileSync(this.path, JSON.stringify(this.data, null, 2))
    }
  }
  return { Conf }
})

const { getAllSettings, initSettingsForTests, setAllSettings } = await import(
  '../settings'
)

let tempDir = ''

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'mvm-settings-'))
  initSettingsForTests(tempDir)
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('settings', () => {
  it('returns defaults on first load', () => {
    const s = getAllSettings()
    expect(s.scrivenerPath).toBe('')
    expect(s.providerKind).toBe('anthropic')
    expect(s.model).toBe('claude-haiku-4-5-20251001')
    expect(s.theme).toBe('dark')
  })

  it('persists a partial patch via setAllSettings', () => {
    setAllSettings({ novelTitle: 'My Novel', apiKey: 'sk-test' })
    const s = getAllSettings()
    expect(s.novelTitle).toBe('My Novel')
    expect(s.apiKey).toBe('sk-test')
    expect(s.providerKind).toBe('anthropic')
  })

  it('round-trips a full settings object', () => {
    setAllSettings({
      scrivenerPath: '/a/b.scriv',
      vaultPath: '/c/d',
      novelTitle: 'T',
      providerKind: 'openai-compatible',
      apiKey: 'k',
      model: 'gpt-5',
      baseURL: 'https://api.openai.com/v1',
      theme: 'light'
    })
    const s = getAllSettings()
    expect(s).toEqual({
      scrivenerPath: '/a/b.scriv',
      vaultPath: '/c/d',
      novelTitle: 'T',
      providerKind: 'openai-compatible',
      apiKey: 'k',
      model: 'gpt-5',
      baseURL: 'https://api.openai.com/v1',
      theme: 'light',
      genrePresetId: 'none',
      characterFields: [],
      locationFields: []
    })
  })

  it('ignores unknown keys in the patch', () => {
    setAllSettings({
      novelTitle: 'Legit',
      // @ts-expect-error testing runtime guard
      bogus: 'nope'
    })
    const s = getAllSettings()
    expect(s.novelTitle).toBe('Legit')
    expect((s as unknown as Record<string, unknown>).bogus).toBeUndefined()
  })

  it('persists across fresh store instances for the same dir', () => {
    setAllSettings({ novelTitle: 'Persisted' })
    initSettingsForTests(tempDir)
    const s = getAllSettings()
    expect(s.novelTitle).toBe('Persisted')
  })
})
