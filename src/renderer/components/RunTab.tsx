import { useMemo } from 'react'

import { findPreset } from '../../shared/presets'
import type {
  ChapterChange,
  LLMProviderConfig,
  SyncOptions,
  VaultGeneratorOptions
} from '../../shared/types'
import { useAppStore } from '../stores/appStore'
import type { RunResult } from '../stores/appStore'
import { PrimaryButton } from './PrimaryButton'
import { ProgressBar } from './ProgressBar'
import { SecondaryButton } from './SecondaryButton'
import { WarningBar } from './WarningBar'

const H2_CLASSES =
  'mb-4 text-2xl font-semibold text-neutral-900 dark:text-neutral-100'

function formatRelative(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const deltaMs = Date.now() - then
  const mins = Math.round(deltaMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function formatCost(cost: number | null): string {
  if (cost === null) return ''
  return `$${cost.toFixed(2)}`
}

function describeChanges(changes: ChapterChange[]): string {
  const counts = { new: 0, modified: 0, reordered: 0, removed: 0 }
  for (const c of changes) counts[c.kind]++
  return `${counts.modified} modified, ${counts.new} new, ${counts.reordered} reordered, ${counts.removed} removed`
}

function buildProviderConfig(
  settings: ReturnType<typeof useAppStore.getState>['settings']
): LLMProviderConfig {
  return {
    kind: settings.providerKind,
    apiKey: settings.apiKey,
    model: settings.model,
    ...(settings.providerKind === 'openai-compatible'
      ? { baseURL: settings.baseURL }
      : {}),
    customCharacterFields: settings.characterFields,
    customLocationFields: settings.locationFields
  }
}

function buildVaultOptions(
  settings: ReturnType<typeof useAppStore.getState>['settings'],
  clean: boolean
): VaultGeneratorOptions {
  const preset = findPreset(settings.genrePresetId)
  return {
    novelTitle: settings.novelTitle,
    clean,
    genrePresetId: settings.genrePresetId,
    characterFields: settings.characterFields,
    locationFields: settings.locationFields,
    characterSectionLabel: preset?.characterSectionLabel ?? 'Tracking',
    locationSectionLabel: preset?.locationSectionLabel ?? 'Tracking'
  }
}

function buildSyncOptions(
  settings: ReturnType<typeof useAppStore.getState>['settings']
): SyncOptions {
  const preset = findPreset(settings.genrePresetId)
  return {
    novelTitle: settings.novelTitle,
    genrePresetId: settings.genrePresetId,
    characterSectionLabel: preset?.characterSectionLabel ?? 'Tracking',
    locationSectionLabel: preset?.locationSectionLabel ?? 'Tracking'
  }
}

export function RunTab(): JSX.Element {
  const mode = useAppStore((s) => s.runMode)
  const progress = useAppStore((s) => s.runProgress)
  const result = useAppStore((s) => s.runResult)
  const error = useAppStore((s) => s.runError)
  const setMode = useAppStore((s) => s.setRunMode)
  const setProgress = useAppStore((s) => s.setRunProgress)
  const setResult = useAppStore((s) => s.setRunResult)
  const setError = useAppStore((s) => s.setRunError)
  const resetRun = useAppStore((s) => s.resetRun)
  const settings = useAppStore((s) => s.settings)
  const hasManifest = useAppStore((s) => s.hasManifest)
  const lastSyncAt = useAppStore((s) => s.lastSyncAt)
  const lastSyncCost = useAppStore((s) => s.lastSyncCost)
  const setHasManifest = useAppStore((s) => s.setHasManifest)
  const setLastSync = useAppStore((s) => s.setLastSync)

  const missing = useMemo(() => computeMissingFields(settings), [settings])
  const settingsComplete = missing.length === 0

  async function handleImport(): Promise<void> {
    setMode('importing')
    setProgress(null)
    setResult(null)
    setError(null)
    try {
      const project = await window.mvm.scrivener.parse(settings.scrivenerPath)
      const extraction = await window.mvm.extraction.run({
        project,
        provider: buildProviderConfig(settings)
      })
      await window.mvm.vault.generate({
        extraction,
        scrivenerProject: project,
        vaultPath: settings.vaultPath,
        options: buildVaultOptions(settings, true)
      })
      await window.mvm.sync.writeInitialManifest({
        project,
        extraction,
        vaultPath: settings.vaultPath
      })
      setMode('completed')
      setResult({
        kind: 'import',
        extractedChapters: extraction.chapters.length,
        tokenUsage: extraction.tokenUsage,
        vaultPath: settings.vaultPath,
        characterCount: extraction.characters.length,
        locationCount: extraction.locations.length,
        timelineEventCount: extraction.timeline.length,
        continuityIssueCount: extraction.continuityIssues.length
      })
      setHasManifest(true)
      setLastSync(
        new Date().toISOString(),
        extraction.tokenUsage.estimatedCostUSD
      )
    } catch (err) {
      setMode('error')
      setError((err as Error).message)
    }
  }

  async function handleSync(): Promise<void> {
    setMode('syncing')
    setProgress(null)
    setResult(null)
    setError(null)
    try {
      const project = await window.mvm.scrivener.parse(settings.scrivenerPath)
      const syncResult = await window.mvm.sync.run({
        project,
        vaultPath: settings.vaultPath,
        providerConfig: buildProviderConfig(settings),
        options: buildSyncOptions(settings)
      })
      setMode('completed')
      setResult({
        kind: 'sync',
        changes: syncResult.changes,
        extractedChapters: syncResult.extractedChapters,
        tokenUsage: syncResult.tokenUsage,
        vaultPath: settings.vaultPath
      })
      setHasManifest(true)
      const summary = await window.mvm.vault.readManifestSummary(
        settings.vaultPath
      )
      if (summary) {
        setLastSync(
          summary.lastSyncAt,
          summary.cumulativeTokenUsage.estimatedCostUSD
        )
      }
    } catch (err) {
      setMode('error')
      setError((err as Error).message)
    }
  }

  async function handleOpenVault(): Promise<void> {
    try {
      await window.mvm.shell.openVault(settings.vaultPath)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  function handleCancel(): void {
    setError('Run cancelled. Partial results discarded.')
    setMode('idle')
    setProgress(null)
  }

  if (mode === 'importing' || mode === 'syncing') {
    return (
      <div className="mx-auto max-w-xl px-6 py-12">
        <h2 className={H2_CLASSES}>
          {mode === 'importing' ? 'Importing Manuscript' : 'Syncing Changes'}
        </h2>
        <p className="mb-1 text-base text-neutral-900 dark:text-neutral-100">
          {progress?.label ?? 'Starting...'}
        </p>
        {progress?.detail ? (
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            {progress.detail}
          </p>
        ) : (
          <div className="mb-4" />
        )}
        <ProgressBar
          current={progress?.currentChapter ?? null}
          total={progress?.totalChapters ?? null}
        />
        <div className="mt-6 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
          <p>Tokens used: {(progress?.tokensUsedSoFar ?? 0).toLocaleString()}</p>
          <p>
            Estimated cost: ${(progress?.estimatedCostSoFar ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="mt-8">
          <SecondaryButton onClick={handleCancel}>Cancel</SecondaryButton>
        </div>
      </div>
    )
  }

  if (mode === 'completed' && result) {
    return (
      <div className="mx-auto max-w-xl px-6 py-12">
        <h2 className="mb-4 text-2xl font-semibold text-green-600 dark:text-green-400">
          ✓ {result.kind === 'import' ? 'Import Complete' : 'Sync Complete'}
        </h2>
        {result.kind === 'import' ? (
          <CompletedImport result={result} />
        ) : (
          <CompletedSync result={result} />
        )}
        <div className="mt-8 flex gap-3">
          <PrimaryButton onClick={handleOpenVault}>Open Vault</PrimaryButton>
          <SecondaryButton onClick={resetRun}>Done</SecondaryButton>
        </div>
      </div>
    )
  }

  if (mode === 'error') {
    const friendlyTail = error && /api key|credentials|auth/i.test(error)
      ? ' Double-check your API key in Settings.'
      : ''
    return (
      <div className="mx-auto max-w-xl px-6 py-12">
        <h2 className="mb-4 text-2xl font-semibold text-red-600 dark:text-red-400">
          ✗ Run Failed
        </h2>
        <pre className="mb-4 max-w-lg whitespace-pre-wrap rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          {error}
          {friendlyTail}
        </pre>
        <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
          If you were importing, no vault files were written. Settings are unchanged.
        </p>
        <SecondaryButton onClick={resetRun}>Back to Run</SecondaryButton>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-8">
      <h2 className={H2_CLASSES}>Run</h2>
      {lastSyncAt ? (
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          Last synced {formatRelative(lastSyncAt)}
          {lastSyncCost !== null ? ` • ${formatCost(lastSyncCost)}` : ''}
        </p>
      ) : null}

      {!settingsComplete ? (
        <WarningBar>
          <div className="font-medium">⚠ Complete your settings first.</div>
          <div className="mt-1 text-xs">Missing: {missing.join(', ')}</div>
        </WarningBar>
      ) : null}

      <div className="space-y-4">
        <RunActionCard
          title="Import Full Manuscript"
          description="First-time extraction of every chapter. Typical cost: $3–10 depending on novel length and model choice."
          disabled={!settingsComplete}
          primary
          onClick={handleImport}
        />
        <RunActionCard
          title="Sync Changes"
          description="Re-extract only chapters that changed since last sync. Typical cost: pennies."
          disabled={!settingsComplete || !hasManifest}
          disabledReason={
            !hasManifest && settingsComplete
              ? 'Run Import Full Manuscript first.'
              : undefined
          }
          onClick={handleSync}
        />
      </div>
    </div>
  )
}

interface RunActionCardProps {
  title: string
  description: string
  disabled: boolean
  disabledReason?: string
  primary?: boolean
  onClick: () => void
}

function RunActionCard({
  title,
  description,
  disabled,
  disabledReason,
  primary,
  onClick
}: RunActionCardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled && disabledReason ? disabledReason : undefined}
      className={`w-full rounded-md border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        primary
          ? 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700'
          : 'border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'
      }`}
    >
      <div className="text-base font-medium">{title}</div>
      <div
        className={`mt-1 text-sm ${
          primary
            ? 'text-sky-100'
            : 'text-neutral-600 dark:text-neutral-400'
        }`}
      >
        {description}
      </div>
    </button>
  )
}

function CompletedImport({
  result
}: {
  result: Extract<RunResult, { kind: 'import' }>
}): JSX.Element {
  return (
    <div className="space-y-1 text-sm text-neutral-900 dark:text-neutral-100">
      <p>Extracted {result.extractedChapters} chapters</p>
      <p>
        {result.characterCount} characters, {result.locationCount} locations,{' '}
        {result.timelineEventCount} timeline events
      </p>
      <p>{result.continuityIssueCount} continuity issues flagged</p>
      <p className="pt-2 text-neutral-600 dark:text-neutral-400">
        Tokens: {result.tokenUsage.inputTokens.toLocaleString()} in /{' '}
        {result.tokenUsage.outputTokens.toLocaleString()} out
      </p>
      <p className="text-neutral-600 dark:text-neutral-400">
        Cost: ${result.tokenUsage.estimatedCostUSD.toFixed(2)}
      </p>
    </div>
  )
}

function CompletedSync({
  result
}: {
  result: Extract<RunResult, { kind: 'sync' }>
}): JSX.Element {
  return (
    <div className="space-y-1 text-sm text-neutral-900 dark:text-neutral-100">
      <p>Synced {result.extractedChapters} chapters</p>
      <p className="text-neutral-600 dark:text-neutral-400">
        {describeChanges(result.changes)}
      </p>
      <p className="pt-2 text-neutral-600 dark:text-neutral-400">
        Tokens: {result.tokenUsage.inputTokens.toLocaleString()} in /{' '}
        {result.tokenUsage.outputTokens.toLocaleString()} out
      </p>
      <p className="text-neutral-600 dark:text-neutral-400">
        Cost: ${result.tokenUsage.estimatedCostUSD.toFixed(2)}
      </p>
    </div>
  )
}

function computeMissingFields(
  settings: ReturnType<typeof useAppStore.getState>['settings']
): string[] {
  const missing: string[] = []
  if (!settings.scrivenerPath) missing.push('Scrivener project')
  if (!settings.vaultPath) missing.push('vault path')
  if (!settings.novelTitle) missing.push('novel title')
  if (!settings.apiKey) missing.push('API key')
  if (!settings.model) missing.push('model')
  if (settings.providerKind === 'openai-compatible' && !settings.baseURL) {
    missing.push('base URL')
  }
  return missing
}
