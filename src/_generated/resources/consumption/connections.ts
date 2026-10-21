// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../_config.js'
import type { HttpClient } from '../../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../../_pagination.js'
import { asRecord, invokeWithRetry } from '../../../_request.js'
import { validatePageSize } from '../../../_validation.js'
import type { Connection } from '../../../types/connections.js'

/** Generated base for the consumption `connections` resource. */
export class ConnectionsResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
  ) {}

  /**
   * List connections.
   *
   * Returns a paginated page of warehouse and SaaS integration connections the caller can `use`.
   * Connections the caller cannot access are filtered out. Use the returned `id` when creating
   * saved-query context items. Pagination uses an opaque token returned in `nextPageToken`.
   *
   * **Requires:** `context:read`
   *
   * @param options.pageSize - Max items per page. Defaults to 25, clamped to 100.
   * @param options.pageToken - Opaque page token from a previous response's `nextPageToken`. Omit
   *   for the first page.
   * @param options.type - Filter by effective integration category (case-sensitive exact match).
   * @returns A page of connections.
   */
  list(options: {
    pageSize?: number
    pageToken?: string
    type?: string
  } = {}): Promise<Page<Connection>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken, options.type)
  }

  protected async listPage(
    pageSize: number,
    pageToken: string | undefined,
    type?: string,
  ): Promise<Page<Connection>> {
    const extra: Record<string, string> = {}
    if (type !== undefined) extra.type = type
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ConnectionsController_list', {
        query: aipListParams(pageSize, pageToken, extra) as Record<
          string,
          string | number | boolean | undefined | null
        >,
      }),
    )
    return buildAipPage(
      data,
      'connections',
      (raw) => raw as Connection,
      (token) => this.listPage(pageSize, token, type),
    )
  }
}
