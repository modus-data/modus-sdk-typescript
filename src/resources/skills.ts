import { chatBuffered, chatStreamSession, type ChatStream } from '../_chat.js'
import type { ModusConfig } from '../_config.js'
import type { HttpClient } from '../_http.js'
import { aipListParams, buildAipPage, type Page } from '../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../_request.js'
import { validateId, validatePageSize } from '../_validation.js'
import type { ChatModel, ChatResult } from '../types/chat.js'
import type { SkillContextComposition } from '../types/context-compose.js'
import type { Skill } from '../types/skills.js'
import type { VariationView } from '../types/views.js'
import { ScopeConversationsResource } from './skills/conversations.js'

function scopesListParams(
  pageSize: number,
  pageToken: string | undefined,
  search?: string,
  view?: VariationView,
  managerId?: number,
): Record<string, string | number | boolean | undefined | null> {
  const extra: Record<string, string | number | boolean | undefined | null> = {}
  if (search !== undefined) extra.search = search
  if (view !== undefined) extra.view = view
  if (managerId !== undefined) extra.managerId = managerId
  return aipListParams(pageSize, pageToken, extra) as Record<
    string,
    string | number | boolean | undefined | null
  >
}

function parseScope(raw: unknown): Skill {
  return raw as Skill
}

/** Read / invoke access to Modus scopes (`/api/v1/scopes`). */
export class ScopesResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  conversations(scopeId: number | string): ScopeConversationsResource {
    return new ScopeConversationsResource(this.http, this.config, scopeId)
  }

  list(options: {
    pageSize?: number
    pageToken?: string
    search?: string
    view?: VariationView
    managerId?: number
  } = {}): Promise<Page<Skill>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(
      pageSize,
      options.pageToken,
      options.search,
      options.view,
      options.managerId,
    )
  }

  private async listPage(
    pageSize: number,
    pageToken: string | undefined,
    search?: string,
    view?: VariationView,
    managerId?: number,
  ): Promise<Page<Skill>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ScopesController_list', {
        query: scopesListParams(pageSize, pageToken, search, view, managerId),
      }),
    )
    // The list response envelope key is the server DTO property name, which
    // this rename intentionally left as `skills` (only paths/opIds/tags moved
    // to the scopes vocab — response body schemas are unchanged).
    return buildAipPage(data, 'skills', parseScope, (token) =>
      this.listPage(pageSize, token, search, view, managerId),
    )
  }

  async get(
    scopeId: number | string,
    options: { view?: VariationView } = {},
  ): Promise<Skill> {
    validateId(scopeId, 'scope_id')
    const query = options.view !== undefined ? { view: options.view } : undefined
    const data = await invokeWithRetry(this.config, this.http, 'ScopesController_get', {
      pathParams: { id: scopeId },
      query,
    })
    return parseScope(data)
  }

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

  chat(
    scopeId: number | string,
    message: string,
    options: { model: ChatModel; threadId?: string },
  ): Promise<ChatResult> {
    return chatBuffered(this.http, 'scopes', scopeId, message, options)
  }

  chatStream(
    scopeId: number | string,
    message: string,
    options: { model: ChatModel; threadId?: string; version?: string },
  ): ChatStream {
    return chatStreamSession(this.http, this.config, 'scopes', scopeId, message, options)
  }
}
