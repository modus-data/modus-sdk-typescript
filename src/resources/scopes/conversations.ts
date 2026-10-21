import { ScopesConversationsResourceBase } from '../../_generated/resources/consumption/scopes/conversations.js'
import { invokeWithRetry } from '../../_request.js'
import { validateId } from '../../_validation.js'
import type { Conversation } from '../../types/conversations.js'

function parseConversation(raw: unknown): Conversation {
  return raw as Conversation
}

/** Conversation threads for a single published scope (`client.scopes.conversations(scopeId)`). */
export class ScopeConversationsResource extends ScopesConversationsResourceBase {

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
