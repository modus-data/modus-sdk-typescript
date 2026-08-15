import type { components } from '../_generated/v1.js'

export type FileUpload = components['schemas']['FileUploadResourceDto']
export type FileUploadStatus = components['schemas']['FileUploadResourceStatus']
export type UploadUrlSlot = components['schemas']['UploadUrlResponseDto']
export type BulkUploadUrlsResult = components['schemas']['BulkUploadUrlsResponseDto']
export type BulkUploadFromUrlsResult = components['schemas']['BulkUploadFromUrlsResponseDto']
export type FailedUploadUrl = components['schemas']['FailedUploadUrlDto']
export type FailedUploadFromUrl = components['schemas']['FailedUploadFromUrlDto']

/** `"processing"` (parsing started) or `"ready"` (parsing finished) — target status for `upload()` / `uploadDir()`. */
export type WaitUntil = 'processing' | 'ready'

/** One file entry for `createUploadUrls()`. */
export interface UploadUrlInput {
  fileName: string
  contentType: string
  fileSize: number
}

/** One URL entry for `uploadFromUrls()`. */
export interface UploadFromUrlInput {
  url: string
  fileName?: string
}

/** A single file that failed during `uploadDir()` (slot creation or PUT/poll). */
export interface UploadDirFailure {
  path: string
  error: string
}

/** Outcome of `uploadDir()` — successes and per-file failures. */
export interface UploadDirResult {
  uploaded: FileUpload[]
  failed: UploadDirFailure[]
}

/** Progress event after each file succeeds or fails in a batch upload. */
export interface UploadProgress {
  completed: number
  total: number
  succeeded: number
  failed: number
}

export type UploadProgressCallback = (progress: UploadProgress) => void

/** One entry of a bulk finalize request. */
export interface FinalizeInput {
  uploadId: string
  fileName: string
}

/** One entry that could not be finalized. */
export interface FinalizeFailure {
  index: number
  uploadId: string
  error: string
}

/** Result of `finalizeMany` — partial success, never a partial 4xx. */
export interface BulkFinalizeResult {
  finalized: FileUpload[]
  failed: FinalizeFailure[]
}
