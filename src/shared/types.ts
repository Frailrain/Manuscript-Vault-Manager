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
}

export interface ExtractedCharacter {
  name: string
  aliases: string[]
  description: string
  role: string
  relationships: Array<{ name: string; relationship: string }>
  firstAppearanceChapter: number
  appearances: number[]
}

export interface ExtractedLocation {
  name: string
  description: string
  significance: string
  firstAppearanceChapter: number
  appearances: number[]
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
      }
      sync: { check: (payload: unknown) => Promise<unknown> }
      settings: {
        get: (key: string) => Promise<unknown>
        set: (key: string, value: unknown) => Promise<unknown>
      }
    }
  }
}

export {}
