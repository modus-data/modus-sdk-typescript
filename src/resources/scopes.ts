import { chatBuffered, chatStreamSession, type ChatStream } from '../_chat.js'
import type { ModusConfig } from '../_config.js'
import type { HttpClient } from '../_http.js'
import { aipListParams, buildAipPage, type Page } from '../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../_request.js'
import { validateId, validatePageSize } from '../_validation.js'
import type { ChatModel, ChatResult } from '../types/chat.js'
import type { SkillContextComposition } from '../types/context-compose.js'
import type { Scope } from '../types/scopes.js'
import type { VariationView } from '../types/views.js'
import { ScopeConversationsResource } from './scopes/conversations.js'

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

function parseScope(raw: unknown): Scope {
  return raw as Scope
}

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
export class ScopesResource {
  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

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
   * List scopes in the organisation.
   *
   * @param options.pageSize - Items per page (default 25).
   * @param options.pageToken - Opaque token from a previous page.
   * @param options.search - Case-insensitive substring filter on the scope name.
   * @param options.view - `"active"` (deployed) or `"draft"`.
   * @param options.managerId - Only scopes supervised by this manager scope id.
   * @returns Page of scopes — use `.autoPagingIter()` for all pages.
   *
   * @example
   * ```ts
   * for await (const scope of (await client.scopes.list()).autoPagingIter()) {
   *   console.log(scope.id, scope.name, scope.status)
   * }
   * ```
   */
  list(options: {
    pageSize?: number
    pageToken?: string
    search?: string
    view?: VariationView
    managerId?: number
  } = {}): Promise<Page<Scope>> {
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
  ): Promise<Page<Scope>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ScopesController_list', {
        query: scopesListParams(pageSize, pageToken, search, view, managerId),
      }),
    )
    // List responses require the canonical `scopes` key (dual `skills` envelope removed).
    return buildAipPage(
      data,
      'scopes',
      parseScope,
      (token) => this.listPage(pageSize, token, search, view, managerId),
    )
  }

  /**
   * Retrieve a scope by ID or slug.
   *
   * @param scopeId - Scope numeric id or slug.
   * @param options.view - `"active"` (deployed) or `"draft"`.
   * @throws {NotFoundError} When no scope matches the id or slug.
   * @returns Scope (`id`, `name`, `status`, …).
   *
   * @example
   * ```ts
   * const scope = await client.scopes.get('revenue-analysis')
   * console.log(scope.name, scope.status)
   * ```
   */
  async get(
    scopeId: number | string,
    options: { view?: VariationView } = {},
  ): Promise<Scope> {
    validateId(scopeId, 'scope_id')
    const query = options.view !== undefined ? { view: options.view } : undefined
    const data = await invokeWithRetry(this.config, this.http, 'ScopesController_get', {
      pathParams: { id: scopeId },
      query,
    })
    return parseScope(data)
  }

  /**
   * Compose context this scope would use for an intent, without running chat.
   *
   * @param scopeId - Scope numeric id or slug.
   * @param message - Natural-language intent used to select context.
   * @param options.limit - Maximum context items to return. Omit to return all selected items.
   * @returns Composition metadata. Use `chat` when you need an assistant reply.
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
