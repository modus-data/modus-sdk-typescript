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

  async getContext(
    message: string,
    options: { limit?: number } = {},
  ): Promise<ModusContextComposition> {
    const data = await invokeWithRetry(this.config, this.http, 'ModusContextController_compose', {
      jsonBody: omitUndefined({ message, limit: options.limit }),
    })
    return data as ModusContextComposition
  }

  chat(message: string, options: { model: ChatModel; threadId?: string }): Promise<ChatResult> {
    return modusChatBuffered(this.http, message, options)
  }

  chatStream(message: string, options: { model: ChatModel; threadId?: string }): ChatStream {
    return modusChatStreamSession(this.http, message, options)
  }
}
