// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../../_config.js'
import type { HttpClient } from '../../../../_http.js'
import { invokeWithRetry, omitUndefined } from '../../../../_request.js'
import type { ContextItemsQuery, ContextItemsQueryResult } from '../../../../types/context.js'

/** Generated base for the consumption `context.items` resource. */
export class ContextItemsResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
  ) {}

  /**
   * Query context items with SQL.
   *
   * Runs one read-only SQL statement over the `context_items` table and returns its rows. The query
   * sees only the items you can read. A query that is not read-only or not valid returns 400; one
   * that runs past 20 s returns 422.
   *
   * **Requires:** `context:read`
   *
   * @param query - Request body; see `ContextItemsQuery`.
   *
   * @example
   * ```ts
   * const result = await modus.context.items.query({
   *   sql: 'SELECT context_type, count(*) AS items FROM context_items GROUP BY context_type',
   * })
   * result.rows
   * ```
   */
  async query(query: ContextItemsQuery): Promise<ContextItemsQueryResult> {
    const data = await invokeWithRetry(this.config, this.http, 'ContextItemsQueryController_query', {
      jsonBody: omitUndefined(query as Record<string, unknown>),
    })
    return data as ContextItemsQueryResult
  }
}
