// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../../_config.js'
import type { HttpClient } from '../../../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../../../_pagination.js'
import { updateMaskQuery } from '../../../../_query.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../../../../_request.js'
import { validateId, validatePageSize } from '../../../../_validation.js'
import type {
  Memory,
  MemorySearchRequest,
  MemorySearchResult,
  MemoryUpdate,
} from '../../../../management/types/memories.js'

/** Generated base for the management `scopes.memories` resource. */
export class ScopesMemoriesResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
    protected readonly scopeId: number | string,
  ) {}

  /**
   * List scope memories.
   *
   * Returns a page of the scope’s memories (up to 1000 total). Pass `nextPageToken` as `pageToken`
   * to fetch the next page. Optional `userId` filters to one end user.
   *
   * **Requires:** `scopes:read`
   *
   * @param options.pageSize - Items per page. Defaults to 100 when no pagination params are sent
   *   (legacy); otherwise 25, clamped to 100.
   * @param options.pageToken - Opaque page token from a previous response's `nextPageToken`. Omit
   *   for the first page.
   * @param options.userId - Narrow results to memories tagged with this end-user id.
   * @returns A page of memories.
   */
  list(options: {
    pageSize?: number
    pageToken?: string
    userId?: string
  } = {}): Promise<Page<Memory>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken, options.userId)
  }

  protected async listPage(
    pageSize: number,
    pageToken: string | undefined,
    userId?: string,
  ): Promise<Page<Memory>> {
    validateId(this.scopeId, 'scope_id')
    const extra: Record<string, string> = {}
    if (userId !== undefined) extra.userId = userId
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ScopeMemoriesController_list', {
        pathParams: { id: this.scopeId },
        query: aipListParams(pageSize, pageToken, extra) as Record<
          string,
          string | number | boolean | undefined | null
        >,
      }),
    )
    return buildAipPage(
      data,
      'memories',
      (raw) => raw as Memory,
      (token) => this.listPage(pageSize, token, userId),
    )
  }

  /**
   * Search scope memories.
   *
   * Returns memories ranked by semantic similarity to the supplied `query`. Caller must at least
   * `use` the scope. Optional `userId` and `limit` body fields narrow the result set (legacy parity
   * with `search-memories`).
   *
   * **Requires:** `scopes:read`
   *
   * @param request - Request body; see {@link MemorySearchRequest}.
   */
  async search(request: MemorySearchRequest): Promise<MemorySearchResult> {
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'ScopeMemoriesController_search', {
      pathParams: { id: this.scopeId },
      jsonBody: omitUndefined(request as Record<string, unknown>),
    })
    return data as MemorySearchResult
  }

  /**
   * Update a memory.
   *
   * Updates one memory. Supply at least one of `memory` or `metadata`. Use `updateMask` to limit
   * which fields change.
   *
   * **Requires:** `scopes:write`
   *
   * @param memoryId - Opaque memory id as returned by the list / search endpoints.
   * @param update - Request body; see {@link MemoryUpdate}.
   * @param options.updateMask - Comma-separated list of fields to update. Omit to update all
   *   provided fields.
   */
  async update(
    memoryId: string,
    update: MemoryUpdate,
    options: { updateMask?: string } = {},
  ): Promise<Memory> {
    validateId(memoryId, 'memory_id')
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'ScopeMemoriesController_update', {
      pathParams: { id: this.scopeId, memoryId },
      query: updateMaskQuery(options.updateMask),
      jsonBody: omitUndefined(update as Record<string, unknown>),
    })
    return data as Memory
  }

  /**
   * Delete a memory.
   *
   * Deletes one memory. Deleting an already-deleted memory is a no-op.
   *
   * **Requires:** `scopes:write`
   *
   * @param memoryId - Opaque memory id as returned by the list / search endpoints.
   */
  async delete(memoryId: string): Promise<void> {
    validateId(memoryId, 'memory_id')
    validateId(this.scopeId, 'scope_id')
    await invokeWithRetry(this.config, this.http, 'ScopeMemoriesController_delete', {
      pathParams: { id: this.scopeId, memoryId },
    })
  }
}
