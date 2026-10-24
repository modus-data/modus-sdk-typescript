// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../../_config.js'
import type { HttpClient } from '../../../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../../../_pagination.js'
import { asRecord, invokeWithRetry } from '../../../../_request.js'
import { validateId, validatePageSize } from '../../../../_validation.js'
import type { ConversationListItem } from '../../../../types/conversations.js'

/** Generated base for the consumption `scopes.conversations` resource. */
export class ScopesConversationsResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
    protected readonly scopeId: number | string,
  ) {}

  /**
   * List scope conversations.
   *
   * Returns a page of conversation summaries (most recently updated first) for a scope. Use `id=0`
   * for your cross-scope recent history. Pass `nextPageToken` as `pageToken` to fetch the next
   * page.
   *
   * **Requires:** `scopes:read`
   *
   * @param options.pageSize - Items per page. Defaults to 25.
   * @param options.pageToken - Opaque page token from a previous response's `nextPageToken`. Omit
   *   for the first page.
   * @param options.source - Return only conversations started from this UI surface.
   * @param options.sourceRef - Narrow `source` to one instance of that surface — for
   *   `dashboard_copilot` or `dashboard_assistant`, a dashboard id (both scope conversation history
   *   per dashboard). Requires `source`; sent alone it is a 422.
   * @returns A page of conversations.
   *
   * @example
   * ```ts
   * for await (const row of (
   *   await client.scopes.conversations(scopeId).list({ pageSize: 10 })
   * ).autoPagingIter()) {
   *   console.log(row.threadId, row.firstMessage, row.messageCount)
   * }
   * ```
   */
  list(options: {
    pageSize?: number
    pageToken?: string
    source?: string
    sourceRef?: string
  } = {}): Promise<Page<ConversationListItem>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken, options.source, options.sourceRef)
  }

  protected async listPage(
    pageSize: number,
    pageToken: string | undefined,
    source?: string,
    sourceRef?: string,
  ): Promise<Page<ConversationListItem>> {
    validateId(this.scopeId, 'scope_id')
    const extra: Record<string, string> = {}
    if (source !== undefined) extra.source = source
    if (sourceRef !== undefined) extra.sourceRef = sourceRef
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ScopeConversationsController_list', {
        pathParams: { id: this.scopeId },
        query: aipListParams(pageSize, pageToken, extra) as Record<
          string,
          string | number | boolean | undefined | null
        >,
      }),
    )
    return buildAipPage(
      data,
      'conversations',
      (raw) => raw as ConversationListItem,
      (token) => this.listPage(pageSize, token, source, sourceRef),
    )
  }
}
