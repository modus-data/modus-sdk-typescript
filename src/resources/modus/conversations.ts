import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry } from '../../_request.js'
import { validateId, validatePageSize } from '../../_validation.js'
import type {
  Conversation,
  ConversationKind,
  ConversationListItem,
} from '../../types/conversations.js'

const ALLOWED_KINDS = new Set<ConversationKind>(['all', 'modus', 'scopes'])

function listParams(
  pageSize: number,
  pageToken: string | undefined,
  kind?: ConversationKind,
): Record<string, string | number | boolean | undefined | null> {
  if (kind !== undefined && !ALLOWED_KINDS.has(kind)) {
    throw new Error(
      `kind must be one of ${[...ALLOWED_KINDS].sort().join(', ')}, got ${JSON.stringify(kind)}`,
    )
  }
  const extra: Record<string, string> = {}
  if (kind !== undefined) extra.kind = kind
  return aipListParams(pageSize, pageToken, extra) as Record<
    string,
    string | number | boolean | undefined | null
  >
}

function parseListItem(raw: unknown): ConversationListItem {
  return raw as ConversationListItem
}

function parseConversation(raw: unknown): Conversation {
  return raw as Conversation
}

/** List and retrieve Modus / scope conversations. */
export class ModusConversationsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  /**
   * List conversations.
   *
   * @param options.pageSize - Items per page (default 25).
   * @param options.pageToken - Opaque token from a previous page.
   * @param options.kind - `"modus"`, `"scopes"`, or `"all"`.
   * @returns Page of conversation list items.
   */
  list(options: {
    pageSize?: number
    pageToken?: string
    kind?: ConversationKind
  } = {}): Promise<Page<ConversationListItem>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken, options.kind)
  }

  private async listPage(
    pageSize: number,
    pageToken: string | undefined,
    kind?: ConversationKind,
  ): Promise<Page<ConversationListItem>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ModusConversationsController_list', {
        query: listParams(pageSize, pageToken, kind),
      }),
    )
    return buildAipPage(data, 'conversations', parseListItem, (token) =>
      this.listPage(pageSize, token, kind),
    )
  }

  /**
   * Retrieve a conversation thread with full message history.
   *
   * @param threadId - Conversation thread id.
   * @returns Conversation with messages.
   */
  async get(threadId: string): Promise<Conversation> {
    validateId(threadId, 'thread_id')
    const data = await invokeWithRetry(this.config, this.http, 'ModusConversationsController_get', {
      pathParams: { threadId },
    })
    return parseConversation(data)
  }
}
