import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { updateMaskQuery } from '../../_query.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../../_request.js'
import { validateId, validatePageSize } from '../../_validation.js'
import type {
  Memory,
  MemorySearchRequest,
  MemorySearchResult,
  MemoryUpdate,
} from '../types/memories.js'

function parseMemory(raw: unknown): Memory {
  return raw as Memory
}

/** Long-term memory stored per scope. */
export class ScopeMemoriesResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
    private readonly scopeId: number | string,
  ) {}

  /**
   * List memories stored for this scope.
   *
   * @param options.pageSize - Items per page (default 25).
   * @param options.pageToken - Token from a previous page's `nextPageToken`.
   * @param options.userId - Optional end-user id when memories are scoped per user.
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

  private async listPage(
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
    return buildAipPage(data, 'memories', parseMemory, (token) =>
      this.listPage(pageSize, token, userId),
    )
  }

  /**
   * Search this scope's memories by natural-language query.
   *
   * @param request - Query text and optional `userId` / `limit`.
   * @returns Matching memories and relevance scores.
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
   * Update one memory. Requires manage permission on the scope.
   *
   * @param memoryId - Id from list or search.
   * @param update - Fields to change (`memory` and/or `metadata`).
   * @param options.updateMask - Optional comma-separated field names to update.
   * @returns The updated memory.
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
    return parseMemory(data)
  }

  /** Delete one memory (idempotent). */
  async delete(memoryId: string): Promise<void> {
    validateId(memoryId, 'memory_id')
    validateId(this.scopeId, 'scope_id')
    await invokeWithRetry(this.config, this.http, 'ScopeMemoriesController_delete', {
      pathParams: { id: this.scopeId, memoryId },
    })
  }
}
