import { modusChatBuffered, modusChatStreamSession, type ChatStream } from '../../_chat.js'
import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { invokeWithRetry, omitUndefined } from '../../_request.js'
import type { ChatModel, ChatResult } from '../../types/chat.js'
import type { ModusContextComposition } from '../../types/context-compose.js'

import { ModusConversationsResource } from './conversations.js'

/** Org-wide Modus assistant. */
export class ModusResource {
  readonly conversations: ModusConversationsResource

  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {
    this.conversations = new ModusConversationsResource(http, config)
  }

  /**
   * Return composed full-environment context for an intent, without running chat.
   *
   * @param message - User intent or question to compose context for.
   * @param options.limit - Optional cap on structured fallback items.
   * @returns Composed Modus context.
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
   * Send a message to Modus (org-wide assistant) and get the complete reply.
   *
   * @param message - Message to send.
   * @param options.model - Required model id (e.g. `"claude-sonnet-5"`).
   * @param options.threadId - Continue an existing conversation.
   * @returns Chat result with content and threadId.
   *
   * @example
   * ```ts
   * const result = await client.modus.chat('What tables describe revenue?', { model: 'claude-sonnet-5' })
   * console.log(result.content, result.threadId)
   * ```
   */
  chat(message: string, options: { model: ChatModel; threadId?: string }): Promise<ChatResult> {
    return modusChatBuffered(this.http, message, options)
  }

  /**
   * Stream a Modus reply token by token.
   *
   * @param message - Message to send.
   * @param options.model - Required model id (e.g. `"claude-sonnet-5"`).
   * @param options.threadId - Continue an existing conversation.
   * @returns Chat stream.
   */
  chatStream(message: string, options: { model: ChatModel; threadId?: string }): ChatStream {
    return modusChatStreamSession(this.http, this.config, message, options)
  }
}
