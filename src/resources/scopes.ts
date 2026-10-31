import { ScopesResourceBase } from '../_generated/resources/consumption/scopes.js'
import { startChat, type ChatOptions, type ChatSession } from '../_chat.js'
import { invokeWithRetry, omitUndefined } from '../_request.js'
import { validateId } from '../_validation.js'
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
 * const [scope] = (await client.scopes.list()).items
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
   * @param scopeId - Numeric scope id.
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
   * or a full-content fetch operation. Runs on the agent host, like `chat`, so a compose may take
   * up to 90 seconds; keep `timeoutMs` above that. A compose still running at 90 seconds fails
   * with `UPSTREAM_TIMEOUT` (504).
   *
   * @param scopeId - Numeric scope id.
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
    const data = await invokeWithRetry(this.config, this.http, 'ScopeContextComposeController_compose', {
      pathParams: { id: scopeId },
      jsonBody: omitUndefined({ message, limit: options.limit }),
    })
    return data as SkillContextComposition
  }

  /**
   * Chat with a published scope. The reply streams live from the agent host:
   * iterate `textStream()` for tokens, or `await` the result for the final
   * answer. Pass the returned `threadId` back to continue the conversation.
   *
   * For the org-wide assistant use `client.modus.chat` instead.
   *
   * @param scopeId - Numeric scope id (must be active for chat).
   * @param message - User message text.
   * @param options.model - Required model id (e.g. `"claude-sonnet-5.5"`).
   * @param options.threadId - Continue an existing conversation; omit to start new.
   * @returns A chat session — iterate it or `await` it for `content`, `threadId`, `runId`.
   * @throws {ModusError} When no agent host is known for a custom `baseUrl`.
   *
   * @example
   * ```ts
   * const chat = client.scopes.chat(scopeId, 'What is our ARR trend?', { model: 'claude-sonnet-5.5' })
   * for await (const token of chat.textStream()) process.stdout.write(token)
   * const { threadId } = await chat
   * const follow = await client.scopes.chat(scopeId, 'Break that down by segment.', {
   *   model: 'claude-sonnet-5.5',
   *   threadId,
   * })
   * console.log(follow.content)
   * ```
   */
  chat(scopeId: number | string, message: string, options: ChatOptions): ChatSession {
    return startChat(this.http, this.config, { kind: 'scopes', id: scopeId }, message, options)
  }
}
