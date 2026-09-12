import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry } from '../../_request.js'
import { validateId, validatePageSize } from '../../_validation.js'
import type { Conversation, ConversationListItem } from '../../types/conversations.js'

function parseListItem(raw: unknown): ConversationListItem {
  return raw as ConversationListItem
}

function parseConversation(raw: unknown): Conversation {
  return raw as Conversation
}

/** Conversation threads for a single published scope (`client.scopes.conversations(scopeId)`). */
export class ScopeConversationsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
    private readonly scopeId: number | string,
  ) {}

  /**
   * List conversation threads for this scope, newest first.
   *
   * @param options.pageSize - Items per page (default 25).
   * @param options.pageToken - Opaque token from a previous page.
   * @param options.source - Restrict to conversations started from this UI surface
   *   (e.g. `"context_chat"`, `"dashboard_copilot"`, `"slack"`).
   * @param options.sourceRef - Narrow `source` to one instance of that surface — for
   *   `"dashboard_copilot"`, a dashboard id. Requires `source`; the API throws an
   *   `UnprocessableError` (422) if sent on its own. Conversations recorded before
   *   this filter shipped carry no instance key and never match it.
   * @returns Page of conversation list items (`threadId`, `firstMessage`, `messageCount`).
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
  list(
    options: { pageSize?: number; pageToken?: string; source?: string; sourceRef?: string } = {},
  ): Promise<Page<ConversationListItem>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken, options.source, options.sourceRef)
  }

  private async listPage(
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
    return buildAipPage(data, 'conversations', parseListItem, (token) =>
      this.listPage(pageSize, token, source, sourceRef),
    )
  }

  /**
   * Retrieve a thread with full message history.
   *
   * @param threadId - Conversation thread id.
   * @param options.messageLimit - Maximum messages to return (1–100).
   * @param options.beforeMessageIndex - Return messages before this index (requires messageLimit).
   * @returns Conversation with `messages` (`type`, `content`).
   *
   * @example
   * ```ts
   * const thread = await client.scopes.conversations(scopeId).get(row.threadId)
   * for (const msg of thread.messages) {
   *   console.log(msg.type, String(msg.content).slice(0, 80))
   * }
   * ```
   */
  async get(
    threadId: string,
    options: { messageLimit?: number; beforeMessageIndex?: number } = {},
  ): Promise<Conversation> {
    validateId(this.scopeId, 'scope_id')
    validateId(threadId, 'thread_id')
    if (options.beforeMessageIndex !== undefined && options.messageLimit === undefined) {
      throw new Error('beforeMessageIndex requires messageLimit')
    }
    const data = await invokeWithRetry(this.config, this.http, 'ScopeConversationsController_get', {
      pathParams: { id: this.scopeId, threadId },
      query: {
        messageLimit: options.messageLimit,
        beforeMessageIndex: options.beforeMessageIndex,
      },
    })
    return parseConversation(data)
  }
}
