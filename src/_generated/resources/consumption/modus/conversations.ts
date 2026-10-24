// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../../_config.js'
import type { HttpClient } from '../../../../_http.js'
import { invokeWithRetry } from '../../../../_request.js'
import { validateId } from '../../../../_validation.js'
import type { Conversation } from '../../../../types/conversations.js'

/** Generated base for the consumption `modus.conversations` resource. */
export class ModusConversationsResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
  ) {}

  /**
   * Get a Modus conversation.
   *
   * Returns the full message history for a conversation thread.
   *
   * **Requires:** `scopes:read`
   *
   * @param threadId - Thread id from a conversation list or chat response.
   */
  async get(threadId: string): Promise<Conversation> {
    validateId(threadId, 'thread_id')
    const data = await invokeWithRetry(this.config, this.http, 'ModusConversationsController_get', {
      pathParams: { threadId },
    })
    return data as Conversation
  }
}
