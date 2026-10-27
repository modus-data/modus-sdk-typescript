import { startChat, type ChatOptions, type ChatSession } from '../../_chat.js'
import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { invokeWithRetry, omitUndefined } from '../../_request.js'
import type { ModusContextComposition } from '../../types/context-compose.js'

import { ModusConversationsResource } from './conversations.js'

/**
 * Org-wide Modus assistant (full environment context and tools).
 *
 * Prefer `client.modus` over `client.scopes` when the question is not tied to one
 * published scope. Construct with `new Modus()` (reads `MODUS_API_KEY`).
 *
 * - `chat` — stream a reply live, or `await` it for the complete answer
 * - `getContext` — preview composed context without a chat turn
 * - `conversations` — list/get prior Modus threads
 *
 * @example
 * ```ts
 * import { Modus } from '@getmodus/sdk'
 * const client = new Modus()
 * const result = await client.modus.chat('What tables describe revenue?', {
 *   model: 'claude-sonnet-5',
 * })
 * console.log(result.content, result.threadId)
 * ```
 */
export class ModusResource {
  readonly conversations: ModusConversationsResource

  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {
    this.conversations = new ModusConversationsResource(http, config)
  }

  /**
   * Compose full-environment context for an intent without running chat.
   *
   * @param message - Natural-language intent used to select context.
   * @param options.limit - Maximum context items to return. Omit to return all selected items.
   * @returns Composition metadata (counts / session id). Use `chat` for a reply.
   *
   * @example
   * ```ts
   * const ctx = await client.modus.getContext('What tables describe revenue?', { limit: 5 })
   * console.log(ctx.originalCount, ctx.sessionId)
   * ```
   */
  async getContext(
    message: string,
    options: { limit?: number } = {},
  ): Promise<ModusContextComposition> {
    const data = await invokeWithRetry(this.config, this.http, 'ModusContextController_compose', {
      jsonBody: omitUndefined({ message, limit: options.limit }),
    })
    return data as ModusContextComposition
  }

  /**
   * Chat with Modus, the org-wide assistant. The reply streams live from the
   * agent host: iterate `textStream()` for tokens, or `await` the result for
   * the final answer. Pass the returned `threadId` back to continue.
   *
   * @param message - User message text.
   * @param options.model - Required model id (e.g. `"claude-sonnet-5.5"`).
   * @param options.threadId - Continue an existing conversation; omit to start new.
   * @returns A chat session — iterate it or `await` it for `content`, `threadId`, `runId`.
   * @throws {ModusError} When no agent host is known for a custom `baseUrl`.
   *
   * @example
   * ```ts
   * const result = await client.modus.chat('What tables describe revenue?', {
   *   model: 'claude-sonnet-5.5',
   * })
   * console.log(result.content)
   * const follow = client.modus.chat('Break that down by region.', {
   *   model: 'claude-sonnet-5.5',
   *   threadId: result.threadId,
   * })
   * for await (const token of follow.textStream()) process.stdout.write(token)
   * ```
   */
  chat(message: string, options: ChatOptions): ChatSession {
    return startChat(this.http, this.config, { kind: 'modus' }, message, options)
  }
}
