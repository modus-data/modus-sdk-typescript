import { modusChatBuffered, modusChatStreamSession, type ChatStream } from '../../_chat.js'
import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { invokeWithRetry, omitUndefined } from '../../_request.js'
import type { ChatModel, ChatResult } from '../../types/chat.js'
import type { ModusContextComposition } from '../../types/context-compose.js'

import { ModusConversationsResource } from './conversations.js'

/**
 * Org-wide Modus assistant (full environment context and tools).
 *
 * Prefer `client.modus` over `client.scopes` when the question is not tied to one
 * published scope. Construct with `new Modus()` (reads `MODUS_API_KEY`).
 *
 * - `chat` — one complete reply
 * - `chatStream` — print tokens as they arrive (consume `textStream()`)
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
   * Send a message to Modus and wait for the complete reply.
   *
   * @param message - User message text.
   * @param options.model - Required model id (e.g. `"claude-sonnet-5"`).
   * @param options.threadId - Continue an existing conversation; omit to start new.
   * @returns Chat result: `content`, `threadId` (for follow-ups), `runId`.
   *
   * @example
   * ```ts
   * const result = await client.modus.chat('What tables describe revenue?', {
   *   model: 'claude-sonnet-5',
   * })
   * console.log(result.content, result.threadId)
   * const follow = await client.modus.chat('Break that down by region.', {
   *   model: 'claude-sonnet-5',
   *   threadId: result.threadId,
   * })
   * ```
   */
  chat(message: string, options: { model: ChatModel; threadId?: string }): Promise<ChatResult> {
    return modusChatBuffered(this.http, message, options)
  }

  /**
   * Stream a Modus reply token by token (SSE).
   *
   * The request starts when you consume `textStream()` or `eventStream()`.
   *
   * @param message - User message text.
   * @param options.model - Required model id (e.g. `"claude-sonnet-5"`).
   * @param options.threadId - Continue an existing conversation; omit to start new.
   * @returns Chat stream — iterate `textStream()` for tokens.
   *
   * @example
   * ```ts
   * const stream = client.modus.chatStream('Summarize ARR in three bullets.', {
   *   model: 'claude-sonnet-5',
   * })
   * for await (const token of stream.textStream()) {
   *   process.stdout.write(token)
   * }
   * console.log(stream.getFinalResult().threadId)
   * ```
   */
  chatStream(message: string, options: { model: ChatModel; threadId?: string }): ChatStream {
    return modusChatStreamSession(this.http, this.config, message, options)
  }
}
