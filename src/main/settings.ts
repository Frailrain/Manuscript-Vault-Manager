import { Conf } from 'electron-conf'

import type { StoredSettings } from '../shared/types'

const DEFAULTS: StoredSettings = {
  scrivenerPath: '',
  vaultPath: '',
  novelTitle: '',
  providerKind: 'anthropic',
  apiKey: '',
  model: 'claude-haiku-4-5-20251001',
  baseURL: '',
  genrePresetId: 'none',
  characterFields: [],
  locationFields: [],
  theme: 'dark'
}

const KEYS = Object.keys(DEFAULTS) as Array<keyof StoredSettings>

let store: Conf<StoredSettings> | null = null
let overrideDir: string | undefined

export function initSettingsForTests(dir: string): void {
  overrideDir = dir
  store = null
}

function getStore(): Conf<StoredSettings> {
  if (!store) {
    store = new Conf<StoredSettings>({
      name: 'mvm-settings',
      defaults: DEFAULTS,
      ...(overrideDir ? { dir: overrideDir } : {})
    })
  }
  return store
}

export function getAllSettings(): StoredSettings {
  const s = getStore()
  const out = { ...DEFAULTS }
  for (const key of KEYS) {
    const value = s.get(key)
    if (value !== undefined) {
      ;(out as Record<string, unknown>)[key] = value
    }
  }
  return out
}

export function setAllSettings(
  patch: Partial<StoredSettings>
): StoredSettings {
  const s = getStore()
  for (const [k, v] of Object.entries(patch)) {
    if (KEYS.includes(k as keyof StoredSettings)) {
      s.set(k, v as StoredSettings[keyof StoredSettings])
    }
  }
  return getAllSettings()
}
