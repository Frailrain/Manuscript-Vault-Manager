import { useState } from 'react'

import { useAppStore } from '../stores/appStore'
import { FieldGroup } from './FieldGroup'
import { PathPicker } from './PathPicker'
import { PrimaryButton } from './PrimaryButton'

const INPUT_CLASSES =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const SELECT_CLASSES = INPUT_CLASSES

const ANTHROPIC_MODELS: Array<{ id: string; label: string }> = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (recommended)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7' }
]

export function SettingsTab(): JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const isDirty = useAppStore((s) => s.isSettingsDirty)
  const markClean = useAppStore((s) => s.markSettingsClean)
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSave(): Promise<void> {
    setSaving(true)
    setSaveError(null)
    try {
      await window.mvm.settings.update({ ...settings, theme })
      markClean()
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleThemeChange(next: 'light' | 'dark'): Promise<void> {
    setTheme(next)
    try {
      await window.mvm.settings.update({ theme: next })
    } catch {
      // Non-fatal.
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h2 className="mb-6 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
        Settings
      </h2>

      <FieldGroup
        label="Scrivener Project"
        helpText="Path to your .scriv folder or .scrivx file."
      >
        <PathPicker
          value={settings.scrivenerPath}
          placeholder="/path/to/my-novel.scriv"
          onPick={() => window.mvm.dialogs.pickScrivener()}
          onChange={(v) => setSettings({ scrivenerPath: v })}
        />
      </FieldGroup>

      <FieldGroup
        label="Vault"
        helpText="Folder where your Obsidian vault will live. An empty folder is fine — MVM creates the structure."
      >
        <PathPicker
          value={settings.vaultPath}
          placeholder="/path/to/my-vault"
          onPick={() => window.mvm.dialogs.pickVault()}
          onChange={(v) => setSettings({ vaultPath: v })}
        />
      </FieldGroup>

      <FieldGroup
        label="Novel Title"
        helpText="Appears in the vault dashboard and frontmatter."
      >
        <input
          type="text"
          value={settings.novelTitle}
          onChange={(e) => setSettings({ novelTitle: e.target.value })}
          placeholder="My Fantasy Epic"
          className={INPUT_CLASSES}
        />
      </FieldGroup>

      <FieldGroup label="LLM Provider">
        <select
          value={settings.providerKind}
          onChange={(e) =>
            setSettings({
              providerKind: e.target.value as
                | 'anthropic'
                | 'openai-compatible'
            })
          }
          className={SELECT_CLASSES}
        >
          <option value="anthropic">Anthropic</option>
          <option value="openai-compatible">OpenAI-compatible</option>
        </select>
      </FieldGroup>

      <FieldGroup
        label="Model"
        helpText={
          settings.providerKind === 'anthropic'
            ? 'Claude Haiku 4.5 is fastest and cheapest. Sonnet 4.6 is higher quality at 3× cost.'
            : undefined
        }
      >
        {settings.providerKind === 'anthropic' ? (
          <select
            value={settings.model}
            onChange={(e) => setSettings({ model: e.target.value })}
            className={SELECT_CLASSES}
          >
            {ANTHROPIC_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={settings.model}
            onChange={(e) => setSettings({ model: e.target.value })}
            placeholder="gpt-5.4, qwen-2.5-72b-instruct, etc."
            className={INPUT_CLASSES}
          />
        )}
      </FieldGroup>

      {settings.providerKind === 'openai-compatible' ? (
        <FieldGroup
          label="Base URL"
          helpText={
            <>
              OpenAI: https://api.openai.com/v1
              <br />
              OpenRouter: https://openrouter.ai/api/v1
              <br />
              Ollama (local): http://localhost:11434/v1
            </>
          }
        >
          <input
            type="text"
            value={settings.baseURL}
            onChange={(e) => setSettings({ baseURL: e.target.value })}
            placeholder="https://api.openai.com/v1"
            className={INPUT_CLASSES}
          />
        </FieldGroup>
      ) : null}

      <FieldGroup
        label="API Key"
        helpText="Stored locally on this machine. Never transmitted except to the provider above."
      >
        <input
          type="text"
          value={settings.apiKey}
          onChange={(e) => setSettings({ apiKey: e.target.value })}
          placeholder="sk-ant-api03-..."
          className={INPUT_CLASSES}
        />
      </FieldGroup>

      <FieldGroup label="Theme">
        <div className="inline-flex overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-600">
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={`px-4 py-2 text-sm font-medium ${
              theme === 'light'
                ? 'bg-sky-600 text-white'
                : 'bg-white text-neutral-900 hover:bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'
            }`}
          >
            Light
          </button>
          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={`px-4 py-2 text-sm font-medium ${
              theme === 'dark'
                ? 'bg-sky-600 text-white'
                : 'bg-white text-neutral-900 hover:bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'
            }`}
          >
            Dark
          </button>
        </div>
      </FieldGroup>

      <div className="flex items-center gap-3 pt-2">
        <PrimaryButton onClick={handleSave} disabled={!isDirty || saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </PrimaryButton>
        {savedFlash ? (
          <span className="text-sm text-green-600 dark:text-green-400">
            Saved ✓
          </span>
        ) : null}
      </div>
      {saveError ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          Failed to save: {saveError}
        </p>
      ) : null}
    </div>
  )
}
