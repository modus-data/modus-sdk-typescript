import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { ModusConfig } from '../../_config.js'
import { ModusError } from '../../_exceptions.js'
import type { HttpClient } from '../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry } from '../../_request.js'
import { validateId, validatePageSize } from '../../_validation.js'
import type {
  BulkFinalizeResult,
  BulkUploadFromUrlsResult,
  BulkUploadUrlsResult,
  FileUpload,
  FinalizeInput,
  UploadDirFailure,
  UploadDirResult,
  UploadFromUrlInput,
  UploadProgressCallback,
  UploadUrlInput,
  UploadUrlSlot,
  WaitUntil,
} from '../../types/context-files.js'

/** Bulk `createUploadUrls` / `uploadFromUrls` request cap — matches the backend. */
export const MAX_BULK_UPLOAD_FILES = 100

const DEFAULT_LIST_PAGE_SIZE = 50
const DEFAULT_PUT_TIMEOUT_MS = 60_000
const DEFAULT_POLL_INTERVAL_MS = 500
const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000
const DEFAULT_CONCURRENCY = 10
// `pending` is gone from the public enum: an upload has no resource until it
// is finalized. Kept at rank 0 so an older server still reporting it is
// ordered below `processing` rather than treated as unknown.
const STATUS_ORDER: Record<string, number> = { pending: 0, processing: 1, ready: 2 }
const WAIT_UNTIL_VALUES = new Set<WaitUntil>(['processing', 'ready'])

/**
 * The server owns the extension→MIME table (`EXTENSION_MIME_MAP` in
 * `@modus/file-uploads`) and resolves it whenever a client sends
 * `application/octet-stream`. Sending that instead of guessing locally keeps
 * one source of truth: a client-side table inevitably drifts from the server's
 * allow-list, and a guess the server rejects fails the upload for no reason.
 */
const DEFER_CONTENT_TYPE_TO_SERVER = 'application/octet-stream'

function validateWaitUntil(waitUntil: string): asserts waitUntil is WaitUntil {
  if (!WAIT_UNTIL_VALUES.has(waitUntil as WaitUntil)) {
    throw new Error(`waitUntil must be one of ${[...WAIT_UNTIL_VALUES].join(', ')}, got ${waitUntil}`)
  }
}

function validateBulkSize(count: number, name: string): void {
  if (count === 0) throw new Error(`${name} must not be empty`)
  if (count > MAX_BULK_UPLOAD_FILES) {
    throw new Error(`${name} must have at most ${MAX_BULK_UPLOAD_FILES} entries, got ${count}`)
  }
}

function statusSatisfies(status: string, waitUntil: WaitUntil): boolean {
  if (status === 'failed') return true
  return (STATUS_ORDER[status] ?? 0) >= STATUS_ORDER[waitUntil]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function chunked<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Bounded-concurrency map, preserving input order — the async twin of a thread pool. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
  onItemDone?: (result: R) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function run(): Promise<void> {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      const result = await worker(items[index] as T)
      results[index] = result
      onItemDone?.(result)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run))
  return results
}

async function walkFiles(root: string, recursive: boolean): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (recursive) await walk(full)
      } else if (entry.isFile()) {
        out.push(full)
      }
    }
  }
  await walk(root)
  return out
}

async function putBytes(
  fetchImpl: typeof fetch,
  url: string,
  data: Uint8Array,
  contentType: string,
  timeoutMs: number,
): Promise<void> {
  const response = await fetchImpl(url, {
    method: 'PUT',
    body: data,
    headers: { 'Content-Type': contentType },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new ModusError(`Upload PUT to presigned URL failed with HTTP ${response.status}.`, {
      statusCode: response.status,
      body: text ? text.slice(0, 500) : undefined,
    })
  }
}

function createSlotsPayload(files: readonly UploadUrlInput[]): Record<string, unknown> {
  return {
    files: files.map((f) => ({ fileName: f.fileName, contentType: f.contentType, fileSize: f.fileSize })),
  }
}

function uploadFromUrlsPayload(urls: readonly UploadFromUrlInput[]): Record<string, unknown> {
  return {
    urls: urls.map((u) => (u.fileName !== undefined ? { url: u.url, fileName: u.fileName } : { url: u.url })),
  }
}

type SlotAssignment = { path: string; slot: UploadUrlSlot }

function assignSlots(
  batch: readonly string[],
  result: BulkUploadUrlsResult,
  failed: UploadDirFailure[],
): SlotAssignment[] {
  const failedIndices = new Set(result.failed.map((f) => f.index))
  for (const f of result.failed) {
    failed.push({ path: batch[f.index] as string, error: f.error })
  }
  const remaining = batch.filter((_, i) => !failedIndices.has(i))
  const uploaded = result.uploaded
  if (uploaded.length < remaining.length) {
    for (const path of remaining.slice(uploaded.length)) {
      failed.push({ path, error: 'Server returned fewer upload slots than requested files.' })
    }
  }
  const paired = Math.min(remaining.length, uploaded.length)
  const assignments: SlotAssignment[] = []
  for (let i = 0; i < paired; i++) {
    assignments.push({ path: remaining[i] as string, slot: uploaded[i] as UploadUrlSlot })
  }
  return assignments
}

/**
 * Durable file uploads for `ModusManagement`.
 *
 * Call path: `mgmt.context.files` after `new ModusManagement(...)`.
 *
 * - `upload(path)` / `uploadDir(dirPath)` — presign + PUT + poll convenience helpers.
 * - `createUploadUrl(s)`, `uploadFromUrl(s)`, `get`, `list` — raw operations.
 */
export class ManagementContextFilesResource {
  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  /**
   * Get a presigned S3 PUT URL for one file.
   *
   * @param input.fileName - Original file name — used to build the S3 object key.
   * @param input.contentType - MIME type. Allowed categories: PDF, images, text,
   *   Office/OpenDocument documents, audio, and video.
   * @param input.fileSize - File size in bytes. Rejected above 50MB.
   * @returns Presigned upload slot. PUT the raw bytes to `uploadUrl` within 15
   *   minutes, then call `finalize(slot.uploadId, slot.fileName)`. Pass the
   *   slot's own `fileName` rather than your local basename — the server may
   *   sanitize the requested name when it mints the key, and finalization
   *   re-derives the key from `uploadId` and `fileName`.
   */
  async createUploadUrl(input: UploadUrlInput): Promise<UploadUrlSlot> {
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'ContextFilesController_uploadUrl', {
        jsonBody: { fileName: input.fileName, contentType: input.contentType, fileSize: input.fileSize },
      }),
    ) as unknown as UploadUrlSlot
  }

  /**
   * Get presigned S3 PUT URLs for up to 100 files in one call.
   *
   * @param files - Files to create upload slots for (max 100).
   * @returns Slots for every file that passed validation, plus per-index
   *   failures (bad MIME type, oversize) for the rest — never a partial 4xx.
   */
  async createUploadUrls(files: readonly UploadUrlInput[]): Promise<BulkUploadUrlsResult> {
    validateBulkSize(files.length, 'files')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'ContextFilesController_uploadUrls', {
        jsonBody: createSlotsPayload(files),
      }),
    ) as unknown as BulkUploadUrlsResult
  }

  /**
   * Fetch one file from a URL and land it as durable context.
   *
   * @param url - Source URL to fetch (SSRF-guarded, 50MB cap, same MIME
   *   allow-list as `createUploadUrl`).
   * @param options.fileName - Override file name. Inferred from the URL path when omitted.
   * @returns File upload resource with status `processing` — parsing continues async.
   */
  async uploadFromUrl(url: string, options: { fileName?: string } = {}): Promise<FileUpload> {
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'ContextFilesController_uploadFromUrl', {
        jsonBody: options.fileName !== undefined ? { url, fileName: options.fileName } : { url },
      }),
    ) as unknown as FileUpload
  }

  /**
   * Fetch up to 100 files from URLs in one call.
   *
   * @param urls - URLs to fetch and upload (max 100).
   * @returns File upload resources for every URL that landed, plus per-index
   *   failures for the rest — never a partial 4xx.
   */
  async uploadFromUrls(urls: readonly UploadFromUrlInput[]): Promise<BulkUploadFromUrlsResult> {
    validateBulkSize(urls.length, 'urls')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'ContextFilesController_uploadFromUrls', {
        jsonBody: uploadFromUrlsPayload(urls),
      }),
    ) as unknown as BulkUploadFromUrlsResult
  }

  /**
   * Fetch one file upload by its id.
   *
   * @param uploadId - Upload id returned by `createUploadUrl` / `uploadFromUrl`.
   * @returns The file upload resource, including its processing `status`.
   */
  async get(uploadId: string): Promise<FileUpload> {
    validateId(uploadId, 'uploadId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'ContextFilesController_get', {
        pathParams: { uploadId },
      }),
    ) as unknown as FileUpload
  }

  /**
   * List durable file uploads.
   *
   * @param options.pageSize - Items per page (default 50).
   * @param options.pageToken - Opaque token from a previous page's `nextPageToken`.
   * @returns Page of file uploads. Uploads that only have a pending row (not yet
   *   landed) aren't included here — use `get(uploadId)` for those.
   */
  list(options: { pageSize?: number; pageToken?: string } = {}): Promise<Page<FileUpload>> {
    const pageSize = options.pageSize ?? DEFAULT_LIST_PAGE_SIZE
    validatePageSize(pageSize, 200)
    return this.listPage(pageSize, options.pageToken)
  }

  private async listPage(pageSize: number, pageToken: string | undefined): Promise<Page<FileUpload>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ContextFilesController_list', {
        query: aipListParams(pageSize, pageToken) as Record<
          string,
          string | number | boolean | readonly string[] | undefined | null
        >,
      }),
    )
    return buildAipPage(data, 'files', (raw) => raw as FileUpload, (token) => this.listPage(pageSize, token))
  }


  /**
   * Turn a file already PUT to a presigned URL into durable context.
   *
   * Call this once the PUT completes. The server locates the object from
   * `uploadId` + `fileName` and validates the bytes that actually arrived.
   * Safe to retry — a second call returns the same resource.
   *
   * @param uploadId - Upload id returned by `createUploadUrl`.
   * @param fileName - File name returned alongside it.
   * @returns The file upload resource, status `"processing"`.
   */
  async finalize(uploadId: string, fileName: string): Promise<FileUpload> {
    validateId(uploadId, 'uploadId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'ContextFilesController_finalize', {
        pathParams: { uploadId },
        jsonBody: { fileName },
      }),
    ) as unknown as FileUpload
  }

  /**
   * Finalize up to 100 uploads in one call.
   *
   * What makes directory upload cheap: 2000 files cost 20 requests here rather
   * than 2000.
   *
   * @param uploads - Uploads to finalize (max 100).
   * @returns Resources for every upload that finalized, plus per-index
   *   failures for the rest — never a partial 4xx.
   */
  async finalizeMany(uploads: readonly FinalizeInput[]): Promise<BulkFinalizeResult> {
    validateBulkSize(uploads.length, 'uploads')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'ContextFilesController_finalizeMany', {
        jsonBody: { uploads: uploads.map((u) => ({ uploadId: u.uploadId, fileName: u.fileName })) },
      }),
    ) as unknown as BulkFinalizeResult
  }

  /**
   * Upload an explicit list of local files.
   *
   * Same machinery as `uploadDir`, without the directory walk — use it when
   * the caller already knows which files to send.
   *
   * @param paths - Paths to local files.
   * @param options.concurrency - Max concurrent PUTs (default 10).
   * @param options.waitUntil - `"processing"` (default) or `"ready"`.
   * @param options.onProgress - Optional progress callback after each file.
   */
  async uploadFiles(
    paths: readonly string[],
    options: {
      concurrency?: number
      waitUntil?: WaitUntil
      onProgress?: UploadProgressCallback
    } = {},
  ): Promise<UploadDirResult> {
    return this.uploadPaths([...paths], options)
  }

  /**
   * Upload a local file and wait for it to reach `"processing"` or `"ready"`.
   *
   * Gets a presigned URL, PUTs the file bytes, then polls `get()` until the
   * upload leaves `"pending"` (or reaches `"ready"`/`"failed"`).
   *
   * @param path - Path to a local file.
   * @param options.waitUntil - `"processing"` (parsing started, default) or
   *   `"ready"` (parsing finished).
   * @param options.pollIntervalMs - Milliseconds between status polls.
   * @param options.timeoutMs - Max milliseconds to wait before raising.
   * @returns The file upload resource once it reaches `waitUntil` (or `"failed"`).
   * @throws {ModusError} If the PUT fails, or polling times out.
   */
  async upload(
    path: string,
    options: { waitUntil?: WaitUntil; pollIntervalMs?: number; timeoutMs?: number } = {},
  ): Promise<FileUpload> {
    const waitUntil = options.waitUntil ?? 'processing'
    validateWaitUntil(waitUntil)
    const fileStat = await stat(path)
    if (!fileStat.isFile()) throw new Error(`Not a file: ${path}`)
    const fileName = path.split(/[/\\]/).pop() as string
    const slot = await this.createUploadUrl({
      fileName,
      contentType: DEFER_CONTENT_TYPE_TO_SERVER,
      fileSize: fileStat.size,
    })
    const data = await readFile(path)
    await putBytes(this.config.fetch, slot.uploadUrl, data, slot.contentType, DEFAULT_PUT_TIMEOUT_MS)
    // Finalize returns the resource already at `processing`, so it replaces the
    // first poll rather than adding a round trip. Only `waitUntil: 'ready'`
    // needs to keep polling afterwards.
    const finalized = await this.finalize(slot.uploadId, slot.fileName)
    if (statusSatisfies(finalized.status, waitUntil)) return finalized
    return this.pollUntil(
      slot.uploadId,
      waitUntil,
      options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      options.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS,
    )
  }

  private async pollUntil(
    uploadId: string,
    waitUntil: WaitUntil,
    pollIntervalMs: number,
    timeoutMs: number,
  ): Promise<FileUpload> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const item = await this.get(uploadId)
      if (statusSatisfies(item.status, waitUntil)) return item
      if (Date.now() >= deadline) {
        throw new ModusError(
          `Timed out after ${timeoutMs}ms waiting for upload ${JSON.stringify(uploadId)} to reach ` +
            `status ${JSON.stringify(waitUntil)}; last status was ${JSON.stringify(item.status)}.`,
        )
      }
      await sleep(pollIntervalMs)
    }
  }

  /**
   * Upload every file in a local directory.
   *
   * Walks `path` (skipping hidden files/directories and symlinks), pages
   * through `createUploadUrls()` in batches of up to 100, then PUTs and polls
   * each file with up to `concurrency` in flight at once. A failure on one
   * file does not stop the others — check `result.failed`.
   *
   * @param path - Path to a local directory.
   * @param options.recursive - Recurse into subdirectories (default `true`).
   * @param options.concurrency - Max concurrent PUT+poll operations (default 10).
   * @param options.waitUntil - `"processing"` (default) or `"ready"` — same as `upload()`.
   * @param options.onProgress - Optional progress callback after each file.
   * @returns `UploadDirResult` with every successful `FileUpload` and every
   *   per-file failure (slot creation or PUT/poll), each tagged with its local path.
   */
  async uploadDir(
    path: string,
    options: {
      recursive?: boolean
      concurrency?: number
      waitUntil?: WaitUntil
      onProgress?: UploadProgressCallback
    } = {},
  ): Promise<UploadDirResult> {
    const waitUntil = options.waitUntil ?? 'processing'
    validateWaitUntil(waitUntil)
    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY
    if (concurrency < 1) throw new Error(`concurrency must be >= 1, got ${concurrency}`)
    const dirStat = await stat(path)
    if (!dirStat.isDirectory()) throw new Error(`Not a directory: ${path}`)

    const files = await walkFiles(path, options.recursive ?? true)
    return this.uploadPaths(files, options)
  }

  /** Shared body of `uploadFiles` and `uploadDir`: presign in batches of 100,
   * PUT with bounded concurrency, then bulk-finalize the batch. */
  private async uploadPaths(
    files: readonly string[],
    options: { concurrency?: number; waitUntil?: WaitUntil; onProgress?: UploadProgressCallback },
  ): Promise<UploadDirResult> {
    const waitUntil = options.waitUntil ?? 'processing'
    validateWaitUntil(waitUntil)
    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY
    if (concurrency < 1) throw new Error(`concurrency must be >= 1, got ${concurrency}`)

    const uploaded: FileUpload[] = []
    const failed: UploadDirFailure[] = []
    const total = files.length
    let completed = 0
    const emit = () => {
      completed += 1
      options.onProgress?.({
        completed,
        total,
        succeeded: uploaded.length,
        failed: failed.length,
      })
    }

    for (const batch of chunked(files, MAX_BULK_UPLOAD_FILES)) {
      const failedBefore = failed.length
      const slots = await this.createSlots(batch, failed)
      // createSlots can report several failures from one synchronous call, so tick
      // `failed` up one at a time here — reusing `emit()` would report the final
      // `failed.length` on every tick and break the completed = succeeded + failed
      // invariant for all but the last of them.
      for (let reported = failedBefore + 1; reported <= failed.length; reported += 1) {
        completed += 1
        options.onProgress?.({ completed, total, succeeded: uploaded.length, failed: reported })
      }
      await this.uploadBatch(slots, waitUntil, concurrency, (result) => {
        if ('error' in result) failed.push(result)
        else uploaded.push(result)
        emit()
      })
    }
    return { uploaded, failed }
  }

  private async createSlots(batch: readonly string[], failed: UploadDirFailure[]): Promise<SlotAssignment[]> {
    const readable: string[] = []
    const inputs: UploadUrlInput[] = []
    for (const path of batch) {
      try {
        const fileStat = await stat(path)
        const fileName = path.split(/[/\\]/).pop() as string
        inputs.push({ fileName, contentType: DEFER_CONTENT_TYPE_TO_SERVER, fileSize: fileStat.size })
        readable.push(path)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failed.push({ path, error: message })
      }
    }
    if (inputs.length === 0) return []
    const result = await this.createUploadUrls(inputs)
    return assignSlots(readable, result, failed)
  }

  private async uploadBatch(
    slots: readonly SlotAssignment[],
    waitUntil: WaitUntil,
    concurrency: number,
    onOutcome?: (result: FileUpload | UploadDirFailure) => void,
  ): Promise<(FileUpload | UploadDirFailure)[]> {
    if (slots.length === 0) return []
    const out: (FileUpload | UploadDirFailure)[] = []

    // PUT everything first, collecting the ones whose bytes landed.
    type PutOutcome = { landed: SlotAssignment } | { failure: UploadDirFailure }
    const put = await mapWithConcurrency<SlotAssignment, PutOutcome>(
      slots,
      concurrency,
      async ({ path, slot }) => {
        try {
          const data = await readFile(path)
          await putBytes(this.config.fetch, slot.uploadUrl, data, slot.contentType, DEFAULT_PUT_TIMEOUT_MS)
          return { landed: { path, slot } }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { failure: { path, error: message } }
        }
      },
      (outcome) => {
        // Emit PUT failures as each concurrent worker finishes — do not wait for
        // the rest of the batch / finalize before progress moves.
        if ('failure' in outcome) {
          out.push(outcome.failure)
          onOutcome?.(outcome.failure)
        }
      },
    )
    const landed: SlotAssignment[] = []
    for (const entry of put) {
      if ('failure' in entry) {
        // already recorded + emitted in onItemDone
        continue
      }
      landed.push(entry.landed)
    }
    if (landed.length === 0) return out

    // One bulk finalize for the whole batch — the reason a 2000-file directory
    // costs 20 requests here instead of 2000.
    const result = await this.finalizeMany(
      landed.map(({ slot }) => ({ uploadId: slot.uploadId, fileName: slot.fileName })),
    )
    const failedIndices = new Set(result.failed.map((f) => f.index))
    for (const f of result.failed) {
      const failure: UploadDirFailure = { path: landed[f.index]?.path ?? '', error: f.error }
      out.push(failure)
      onOutcome?.(failure)
    }
    const finalized = result.finalized
    const remaining = landed.filter((_, i) => !failedIndices.has(i))

    if (waitUntil !== 'ready') {
      for (const item of finalized) {
        out.push(item)
        onOutcome?.(item)
      }
      return out
    }

    // Only `ready` needs polling; `processing` is already satisfied by the
    // finalize response.
    await mapWithConcurrency(
      remaining,
      concurrency,
      async ({ path, slot }) => {
        try {
          return await this.pollUntil(slot.uploadId, waitUntil, DEFAULT_POLL_INTERVAL_MS, DEFAULT_UPLOAD_TIMEOUT_MS)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { path, error: message } satisfies UploadDirFailure
        }
      },
      (item) => {
        out.push(item)
        onOutcome?.(item)
      },
    )
    return out
  }
}
