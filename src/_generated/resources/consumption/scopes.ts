// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../_config.js'
import type { HttpClient } from '../../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../../_pagination.js'
import { asRecord, invokeWithRetry } from '../../../_request.js'
import { validateId, validatePageSize } from '../../../_validation.js'
import type { Scope } from '../../../types/scopes.js'
import type { VariationView } from '../../../types/views.js'

/** Generated base for the consumption `scopes` resource. */
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
   * @param options.view - Variation view. `active` reads the deployed version, or the latest draft
   *   when nothing is published. `draft` reads the latest builder snapshot. `published` reads only
   *   the published version, and only scopes you can use.
   * @param options.managerId - Return only scopes supervised by this manager scope id.
   * @returns A page of scopes.
   *
   * @example
   * ```ts
   * for await (const scope of (await client.scopes.list()).autoPagingIter()) {
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
   * Returns a scope. `view=active` (default) is the deployed version, or the latest draft when
   * nothing is published. `view=draft` is the latest edits. `view=published` is only the published
   * version, and only if you can use the scope. Returns 404 if you cannot access it.
   *
   * **Requires:** `scopes:read`
   *
   * @param scopeId - Numeric scope id.
   * @param options.view - Which version to read. Defaults to `active`. `published` is only the
   *   published version, and only if you can use the scope.
   *
   * @example
   * ```ts
   * const [first] = (await client.scopes.list()).items
   * const scope = await client.scopes.get(first.id)
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
}
