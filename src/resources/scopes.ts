import { ScopesResourceBase } from '../_generated/resources/consumption/scopes.js'
import { chatBuffered, chatStreamSession, type ChatStream } from '../_chat.js'
import { invokeWithRetry, omitUndefined } from '../_request.js'
import { validateId } from '../_validation.js'
import type { ChatModel, ChatResult } from '../types/chat.js'
import type { SkillContextComposition } from '../types/context-compose.js'
import { ScopeConversationsResource } from './scopes/conversations.js'

/**
 * Read / chat with published scopes.
 *
 * Call path: `client.scopes` after `new Modus(...)`. Prefer `client.modus` for
 * the org-wide assistant. Create/deploy via `ModusManagement`.
 *
 * @example
 * ```ts
 * const scope = await client.scopes.get('revenue-analysis')
 * const result = await client.scopes.chat(scope.id, 'What is our ARR trend?', {
 *   model: 'claude-sonnet-5',
 * })
 * console.log(result.content, result.threadId)
 * ```
 */
export class ScopesResource extends ScopesResourceBase {

  /**
   * Return the conversations sub-resource scoped to `scopeId`.
   *
   * @param scopeId - Scope numeric id or slug.
   * @returns Conversations resource for the scope.
   *
   * @example
   * ```ts
   * for await (const row of (
   *   await client.scopes.conversations(scopeId).list({ pageSize: 10 })
   * ).autoPagingIter()) {
   *   console.log(row.threadId, row.firstMessage)
   * }
   * ```
   */
  conversations(scopeId: number | string): ScopeConversationsResource {
    return new ScopeConversationsResource(this.http, this.config, scopeId)
  }

  /**
   * Compose context this scope would use for an intent, without running chat.
   *
   * Large bodies are bounded inline previews. This REST method does not expose file references
   * or a full-content fetch operation.
   *
   * @param scopeId - Scope numeric id or slug.
   * @param message - Natural-language intent used to select context.
   * @param options.limit - Maximum context items to return. Omit to return all selected items.
   * @returns Composed context text plus selection counts, item UIDs, and correlation session id.
   *
   * @example
   * ```ts
   * const ctx = await client.scopes.getContext(scopeId, 'Which tables describe churn?', {
   *   limit: 5,
   * })
   * console.log(ctx.originalCount, ctx.sessionId)
   * ```
   */
  async getContext(
    scopeId: number | string,
    message: string,
    options: { limit?: number } = {},
  ): Promise<SkillContextComposition> {
    validateId(scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'ScopeContextController_compose', {
      pathParams: { id: scopeId },
      jsonBody: omitUndefined({ message, limit: options.limit }),
    })
    return data as SkillContextComposition
  }

  /**
   * Send a message to a published scope and wait for the complete reply.
   *
   * For the org-wide assistant use `client.modus.chat` instead.
   *
   * @param scopeId - Scope numeric id or slug (must be active for chat).
   * @param message - User message text.
   * @param options.model - Required model id (e.g. `"claude-sonnet-5"`).
   * @param options.threadId - Continue an existing conversation; omit to start new.
   * @returns Chat result: `content`, `threadId`, `runId`.
   *
   * @example
   * ```ts
   * const result = await client.scopes.chat(scopeId, 'What is our ARR trend?', {
   *   model: 'claude-sonnet-5',
   * })
   * console.log(result.content, result.threadId)
   * const follow = await client.scopes.chat(scopeId, 'Break that down by segment.', {
   *   model: 'claude-sonnet-5',
   *   threadId: result.threadId,
   * })
   * ```
   */
  chat(
    scopeId: number | string,
    message: string,
    options: { model: ChatModel; threadId?: string },
  ): Promise<ChatResult> {
    return chatBuffered(this.http, 'scopes', scopeId, message, options)
  }

  /**
   * Stream a scope reply token by token (SSE).
   *
   * The request starts when you consume `textStream()` or `eventStream()`.
   *
   * @param scopeId - Scope numeric id or slug.
   * @param message - User message text.
   * @param options.model - Required model id (e.g. `"claude-sonnet-5"`).
   * @param options.threadId - Continue an existing conversation; omit to start new.
   * @param options.version - `"published"` or `"draft"`.
   * @returns Chat stream — iterate `textStream()` for tokens.
   *
   * @example
   * ```ts
   * const stream = client.scopes.chatStream(scopeId, 'Summarize in three bullets.', {
   *   model: 'claude-sonnet-5',
   * })
   * for await (const token of stream.textStream()) {
   *   process.stdout.write(token)
   * }
   * console.log(stream.getFinalResult().threadId)
   * ```
   */
  chatStream(
    scopeId: number | string,
    message: string,
    options: { model: ChatModel; threadId?: string; version?: string },
  ): ChatStream {
    return chatStreamSession(this.http, this.config, 'scopes', scopeId, message, options)
  }
}
