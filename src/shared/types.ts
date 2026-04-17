import type { GenreFieldDef, GlossaryEntry } from './presets'

export type CustomFieldValue = string | number | string[]

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

export type LLMProviderKind = 'anthropic' | 'openai-compatible'

export interface LLMProviderConfig {
  kind: LLMProviderKind
  apiKey: string
  model: string
  /** Required for openai-compatible; optional for anthropic (SDK default used). */
  baseURL?: string
  /** Max output tokens per call. Defaults to 4096. */
  maxTokens?: number
  /** Genre-preset or custom character fields to extract. */
  customCharacterFields?: GenreFieldDef[]
  /** Genre-preset or custom location fields to extract. */
  customLocationFields?: GenreFieldDef[]
  /** Genre glossary — disambiguation hints injected into every pass prompt. */
  glossary?: GlossaryEntry[]
}

export type CharacterTier = 'main' | 'secondary' | 'minor'

export interface ExtractedCharacter {
  name: string
  aliases: string[]
  description: string
  /** Per-chapter activity summaries keyed by chapter order. Only chapters where the character acts are included. */
  chapterActivity: Record<number, string>
  role: string
  relationships: Array<{ name: string; relationship: string }>
  firstAppearanceChapter: number
  appearances: number[]
  /** Narrative-weight classification. Highest-wins across chapters. */
  tier: CharacterTier
  /** Genre-preset extracted fields, keyed by field.key. Empty if none configured. */
  customFields: Record<string, CustomFieldValue>
}

export interface ExtractedLocation {
  name: string
  description: string
  significance: string
  firstAppearanceChapter: number
  appearances: number[]
  /** Canonical name of the containing location, or null for top-level locations. */
  parentLocation: string | null
  /** Genre-preset extracted fields, keyed by field.key. Empty if none configured. */
  customFields: Record<string, CustomFieldValue>
}

export interface TimelineEvent {
  chapterOrder: number
  summary: string
  sequence: number
}

export type ContinuitySeverity = 'low' | 'medium' | 'high'

export interface ContinuityIssue {
  severity: ContinuitySeverity
  description: string
  chapters: number[]
  suggestion: string
}

export interface ExtractedCharacterDelta {
  name: string
  aliases: string[]
  description: string
  /** What this character does, experiences, or becomes in this specific chapter. Empty string if merely mentioned. */
  chapterActivity: string
  role: string
  relationships: Array<{ name: string; relationship: string }>
  isNew: boolean
  /** Narrative-weight classification in this chapter. */
  tier: CharacterTier
  /** Genre-preset extracted fields, keyed by field.key. */
  customFields?: Record<string, CustomFieldValue>
}

export interface ExtractedLocationDelta {
  name: string
  description: string
  significance: string
  isNew: boolean
  /** Canonical name of the containing location, or null for top-level locations. */
  parentLocation: string | null
  /** Genre-preset extracted fields, keyed by field.key. */
  customFields?: Record<string, CustomFieldValue>
}

export interface TimelineEventDelta {
  summary: string
  sequence: number
}

export interface ContinuityIssueDelta {
  severity: ContinuitySeverity
  description: string
  suggestion: string
  relatedCharacters: string[]
}

export interface ChapterContribution {
  chapterOrder: number
  chapterUuid: string
  characterDeltas: ExtractedCharacterDelta[]
  locationDeltas: ExtractedLocationDelta[]
  timelineEvents: TimelineEventDelta[]
  continuityIssues: ContinuityIssueDelta[]
}

export type ExtractionPass =
  | 'characters'
  | 'locations'
  | 'timeline'
  | 'continuity'

export interface ChapterExtraction {
  chapterOrder: number
  chapterUuid: string
  chapterTitle: string
  summary: string
  charactersAppearing: string[]
  locationsAppearing: string[]
  passErrors?: Partial<Record<ExtractionPass, string>>
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  estimatedCostUSD: number
}

export interface ExtractionResult {
  projectName: string
  generatedAt: string
  chapters: ChapterExtraction[]
  characters: ExtractedCharacter[]
  locations: ExtractedLocation[]
  timeline: TimelineEvent[]
  continuityIssues: ContinuityIssue[]
  tokenUsage: TokenUsage
  warnings: string[]
  chapterContributions: ChapterContribution[]
}

export interface ExtractionProgress {
  phase: 'preparing' | 'extracting' | 'merging' | 'done'
  currentChapter: number
  totalChapters: number
  currentPass: ExtractionPass | null
  tokensUsedSoFar: number
  estimatedCostSoFar: number
}

export interface ExtractionRunPayload {
  project: ScrivenerProject
  provider: LLMProviderConfig
}

export interface VaultGeneratorOptions {
  novelTitle: string
  /** Wipe Chapters/, Characters/, Locations/ before writing. Default false. */
  clean?: boolean
  onProgress?: (progress: VaultProgress) => void
  /** Active genre preset id — affects dashboard formatting. */
  genrePresetId?: string
  /** Per-character fields to render in the Tracking callout + frontmatter. */
  characterFields?: GenreFieldDef[]
  /** Per-location fields to render in the Tracking callout + frontmatter. */
  locationFields?: GenreFieldDef[]
  /** Callout title for the character Tracking block. Empty string = omit. */
  characterSectionLabel?: string
  /** Callout title for the location Tracking block. Empty string = omit. */
  locationSectionLabel?: string
}

export type VaultPhase =
  | 'chapters'
  | 'characters'
  | 'locations'
  | 'timeline'
  | 'continuity'
  | 'dashboard'

export interface VaultProgress {
  phase: VaultPhase
  current: number
  total: number
  currentFile: string
}

export interface VaultGenerationResult {
  filesWritten: number
  /** Files where existing Writer's Notes were merged in. */
  filesPreserved: number
  vaultPath: string
  durationMs: number
}

export interface VaultGenerateRunPayload {
  extraction: ExtractionResult
  scrivenerProject: ScrivenerProject
  vaultPath: string
  options: VaultGeneratorOptions
}

export interface ManifestChapterEntry {
  chapterUuid: string
  chapterOrder: number
  chapterTitle: string
  /** SHA-256 of the concatenated scene (uuid, contentHash) pairs in order. */
  chapterHash: string
  sceneHashes: Array<{ uuid: string; hash: string }>
}

export interface SyncManifest {
  version: 1
  lastSyncAt: string
  projectName: string
  chapters: ManifestChapterEntry[]
  chapterContributions: ChapterContribution[]
  cumulativeTokenUsage: TokenUsage
  lastExtractionSnapshot: {
    chapters: ChapterExtraction[]
    warnings: string[]
  }
}

export type ChapterChangeKind = 'new' | 'modified' | 'removed' | 'reordered'

export interface ChapterChange {
  kind: ChapterChangeKind
  chapterUuid: string
  newOrder: number | null
  oldOrder: number | null
  title: string
}

export interface SyncOptions {
  novelTitle: string
  /** If true, don't call the LLM or write to disk. Just report what would happen. */
  dryRun?: boolean
  onProgress?: (progress: SyncProgress) => void
  /** Active genre preset id — affects dashboard formatting. */
  genrePresetId?: string
  /** Callout title for the character Tracking block. */
  characterSectionLabel?: string
  /** Callout title for the location Tracking block. */
  locationSectionLabel?: string
}

export type SyncPhase =
  | 'reading-manifest'
  | 'diffing'
  | 'extracting'
  | 'merging'
  | 'regenerating-vault'
  | 'writing-manifest'
  | 'done'

export interface SyncProgress {
  phase: SyncPhase
  currentChapter?: number
  totalChangedChapters?: number
  currentPass?: ExtractionPass | null
  tokensUsedSoFar: number
  estimatedCostSoFar: number
}

export interface SyncResult {
  firstRun: boolean
  changes: ChapterChange[]
  extractedChapters: number
  filesWritten: number
  filesPreserved: number
  tokenUsage: TokenUsage
  durationMs: number
  warnings: string[]
}

export interface SyncRunPayload {
  project: ScrivenerProject
  vaultPath: string
  providerConfig: LLMProviderConfig
  options: SyncOptions
}

export interface AppSettings {
  scrivenerPath: string
  vaultPath: string
  novelTitle: string
  providerKind: LLMProviderKind
  apiKey: string
  model: string
  baseURL: string
  genrePresetId: string
  characterFields: GenreFieldDef[]
  locationFields: GenreFieldDef[]
}

export interface StoredSettings extends AppSettings {
  theme: 'light' | 'dark'
}

export interface ManifestSummary {
  lastSyncAt: string
  cumulativeTokenUsage: TokenUsage
}

export interface WriteInitialManifestPayload {
  project: ScrivenerProject
  extraction: ExtractionResult
  vaultPath: string
}

declare global {
  interface Window {
    mvm: {
      scrivener: { parse: (path: string) => Promise<ScrivenerProject> }
      extraction: {
        run: (payload: ExtractionRunPayload) => Promise<ExtractionResult>
        onProgress: (cb: (progress: ExtractionProgress) => void) => () => void
      }
      vault: {
        generate: (payload: VaultGenerateRunPayload) => Promise<VaultGenerationResult>
        onProgress: (cb: (progress: VaultProgress) => void) => () => void
        hasManifest: (vaultPath: string) => Promise<boolean>
        readManifestSummary: (vaultPath: string) => Promise<ManifestSummary | null>
      }
      sync: {
        run: (payload: SyncRunPayload) => Promise<SyncResult>
        onProgress: (cb: (progress: SyncProgress) => void) => () => void
        writeInitialManifest: (payload: WriteInitialManifestPayload) => Promise<SyncManifest>
      }
      settings: {
        getAll: () => Promise<StoredSettings>
        update: (patch: Partial<StoredSettings>) => Promise<StoredSettings>
      }
      dialogs: {
        pickScrivener: () => Promise<string | null>
        pickVault: () => Promise<string | null>
      }
      shell: {
        openVault: (vaultPath: string) => Promise<{ opened: 'obsidian' | 'folder' }>
      }
    }
  }
}

export {}
