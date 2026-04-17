export { syncProject } from './sync'
export { SyncError } from './errors'
export { readManifest, writeManifest, manifestPath } from './manifest'
export { diffProject } from './diff'
export { hashChapter } from './hashing'
export { rebuildMergedState, type RebuiltMergedState } from './rebuild'
export {
  reExtractChapters,
  type ReExtractOptions,
  type ReExtractPriorState,
  type ReExtractProgress,
  type ReExtractResult
} from './reExtract'
export type {
  ChapterChange,
  ChapterChangeKind,
  ManifestChapterEntry,
  SyncManifest,
  SyncOptions,
  SyncPhase,
  SyncProgress,
  SyncResult,
  SyncRunPayload
} from '../../shared/types'
