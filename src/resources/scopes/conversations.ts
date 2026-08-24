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
  list(options: { pageSize?: number; pageToken?: string } = {}): Promise<Page<ConversationListItem>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken)
  }

  private async listPage(
    pageSize: number,
    pageToken: string | undefined,
  ): Promise<Page<ConversationListItem>> {
    validateId(this.scopeId, 'scope_id')
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ScopeConversationsController_list', {
        pathParams: { id: this.scopeId },
        query: aipListParams(pageSize, pageToken) as Record<
          string,
          string | number | boolean | undefined | null
        >,
      }),
    )
    return buildAipPage(data, 'conversations', parseListItem, (token) =>
      this.listPage(pageSize, token),
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
