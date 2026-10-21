// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../../_config.js'
import type { HttpClient } from '../../../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../../../_pagination.js'
import { asRecord, invokeWithRetry } from '../../../../_request.js'
import { validateId, validatePageSize } from '../../../../_validation.js'
import type { FileUpload } from '../../../../types/context-files.js'

/** Generated base for the management `context.files` resource. */
export class ContextFilesResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
  ) {}

  /**
   * List file uploads.
   *
   * Returns a page of durable landed file uploads. Uploads that have not landed yet are visible via
   * `GET /context/files/{uploadId}`, not this list.
   *
   * **Requires:** `context:read`
   *
   * @param options.pageSize - Items per page. Defaults to 50.
   * @param options.pageToken - Opaque page token from a previous response's `nextPageToken`. Omit
   *   for the first page.
   * @returns A page of files.
   */
  list(options: {
    pageSize?: number
    pageToken?: string
  } = {}): Promise<Page<FileUpload>> {
    const pageSize = options.pageSize ?? 50
    validatePageSize(pageSize, 200)
    return this.listPage(pageSize, options.pageToken)
  }

  protected async listPage(
    pageSize: number,
    pageToken: string | undefined,
  ): Promise<Page<FileUpload>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ContextFilesController_list', {
        query: aipListParams(pageSize, pageToken) as Record<
          string,
          string | number | boolean | undefined | null
        >,
      }),
    )
    return buildAipPage(
      data,
      'files',
      (raw) => raw as FileUpload,
      (token) => this.listPage(pageSize, token),
    )
  }

  /**
   * Get a file upload.
   *
   * Returns status + metadata for one upload. Prefers the durable landed context item; falls back
   * to in-flight upload status while the object has not landed yet. 404 if neither exists.
   *
   * **Requires:** `context:read`
   *
   * @param uploadId - Upload id returned by `createUploadUrl` / `createUploadUrls`.
   */
  async get(uploadId: string): Promise<FileUpload> {
    validateId(uploadId, 'uploadId')
    const data = await invokeWithRetry(this.config, this.http, 'ContextFilesController_get', {
      pathParams: { uploadId },
    })
    return asRecord(data) as unknown as FileUpload
  }
}
