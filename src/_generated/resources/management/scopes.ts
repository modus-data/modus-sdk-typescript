// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../_config.js'
import type { HttpClient } from '../../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../../_pagination.js'
import { asRecord, invokeWithRetry } from '../../../_request.js'
import { validateId, validatePageSize } from '../../../_validation.js'
import type { Scope } from '../../../types/scopes.js'
import type { VariationView } from '../../../types/views.js'

/** Generated base for the management `scopes` resource. */
export class ScopesResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
  ) {}

  /**
   * List scopes.
   *
   * Returns a paginated page of scopes the caller can at least `use`. Scopes the caller cannot see
   * are filtered out. Pagination uses an opaque token returned in `nextPageToken`.
   *
   * **Requires:** `scopes:read`
   *
   * @param options.pageSize - Items per page. Defaults to 25.
   * @param options.pageToken - Opaque page token from a previous response's `nextPageToken`. Omit
   *   for the first page.
   * @param options.search - Case-insensitive substring filter on scope name.
   * @param options.view - Variation view. `active` reads deployed; `draft` reads the latest builder
   *   snapshot.
   * @param options.managerId - Return only scopes supervised by this manager scope id.
   * @returns A page of scopes.
   *
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * for await (const scope of (await mgmt.scopes.list()).autoPagingIter()) {
   *   console.log(scope.id, scope.name, scope.status)
   * }
   * ```
   */
  list(options: {
    pageSize?: number
    pageToken?: string
    search?: string
    view?: VariationView
    managerId?: number
  } = {}): Promise<Page<Scope>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken, options.search, options.view, options.managerId)
  }

  protected async listPage(
    pageSize: number,
    pageToken: string | undefined,
    search?: string,
    view?: VariationView,
    managerId?: number,
  ): Promise<Page<Scope>> {
    const extra: Record<string, string | number> = {}
    if (search !== undefined) extra.search = search
    if (view !== undefined) extra.view = view
    if (managerId !== undefined) extra.managerId = managerId
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ScopesController_list', {
        query: aipListParams(pageSize, pageToken, extra) as Record<
          string,
          string | number | boolean | undefined | null
        >,
      }),
    )
    return buildAipPage(
      data,
      'scopes',
      (raw) => raw as Scope,
      (token) => this.listPage(pageSize, token, search, view, managerId),
    )
  }

  /**
   * Get a scope.
   *
   * Returns a scope. `view=active` (default) returns the deployed version; `view=draft` returns the
   * latest unpublished edits. Returns 404 if you cannot access the scope.
   *
   * **Requires:** `scopes:read`
   *
   * @param scopeId - Numeric scope id.
   * @param options.view - Which variation snapshot to read. Defaults to `active`.
   *
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * const scope = await mgmt.scopes.get('PLACEHOLDER_SCOPE_ID')
   * console.log(scope.name, scope.status)
   * ```
   */
  async get(
    scopeId: number | string,
    options: { view?: VariationView } = {},
  ): Promise<Scope> {
    validateId(scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'ScopesController_get', {
      pathParams: { id: scopeId },
      query: { view: options.view },
    })
    return data as Scope
  }

  /**
   * Delete a scope.
   *
   * Deletes a scope. The scope can be restored later with POST /scopes/{id}/restore. Deleting an
   * already-deleted scope is a no-op.
   *
   * **Requires:** `scopes:write`
   *
   * @param scopeId - Numeric scope id.
   *
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * await mgmt.scopes.delete('PLACEHOLDER_SCOPE_ID')
   * ```
   */
  async delete(scopeId: number | string): Promise<void> {
    validateId(scopeId, 'scope_id')
    await invokeWithRetry(this.config, this.http, 'ScopesController_delete', {
      pathParams: { id: scopeId },
    })
  }

  /**
   * Restore a deleted scope.
   *
   * Restores a previously deleted scope and returns it. Restoring a scope that is already active
   * returns it unchanged.
   *
   * **Requires:** `scopes:write`
   *
   * @param scopeId - Numeric scope id.
   */
  async restore(scopeId: number | string): Promise<Scope> {
    validateId(scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'ScopesController_restore', {
      pathParams: { id: scopeId },
      jsonBody: {},
    })
    return data as Scope
  }

  /**
   * Cancel ownership transfer.
   *
   * Cancels a pending ownership transfer. The current owner may cancel; the pending recipient may
   * decline.
   *
   * **Requires:** `scopes:write`
   *
   * @param scopeId - Numeric scope id.
   */
  async cancelOwnershipTransfer(scopeId: number | string): Promise<Scope> {
    validateId(scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'ScopesController_cancelOwnershipTransfer', {
      pathParams: { id: scopeId },
    })
    return data as Scope
  }

  /**
   * Accept ownership transfer.
   *
   * Accepts a pending ownership transfer. Only the pending recipient may invoke this action.
   *
   * **Requires:** `scopes:write`
   *
   * @param scopeId - Numeric scope id.
   */
  async acceptOwnershipTransfer(scopeId: number | string): Promise<Scope> {
    validateId(scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'ScopesController_acceptOwnershipTransfer', {
      pathParams: { id: scopeId },
      jsonBody: {},
    })
    return data as Scope
  }
}
