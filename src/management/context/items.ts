import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { updateMaskQuery } from '../../_query.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../../_request.js'
import { validatePageSize } from '../../_validation.js'
import type { ContextItem, ContextItemDeletion } from '../../types/context.js'
import type { UserFeedback } from './_content-merge.js'

function contextListParams(
  pageSize: number,
  pageToken: string | undefined,
  contextType?: string,
): Record<string, string | number | boolean | readonly string[] | undefined | null> {
  const extra: Record<string, string | readonly string[]> = {}
  if (contextType !== undefined) extra.contextTypes = [contextType]
  return aipListParams(pageSize, pageToken, extra) as Record<
    string,
    string | number | boolean | readonly string[] | undefined | null
  >
}

function parseContextItem(raw: unknown): ContextItem {
  return raw as ContextItem
}

export class ManagementContextItemsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  /**
   * List context items in the knowledge base.
   *
   * @param options.pageSize - Items per page (default 25).
   * @param options.pageToken - Token from a previous page's `nextPageToken`.
   * @param options.contextType - Filter to one context type (for example `"note"`).
   * @returns A page of context items.
   */
  list(options: {
    pageSize?: number
    pageToken?: string
    contextType?: string
  } = {}): Promise<Page<ContextItem>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken, options.contextType)
  }

  private async listPage(
    pageSize: number,
    pageToken: string | undefined,
    contextType?: string,
  ): Promise<Page<ContextItem>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ContextItemsController_list', {
        query: contextListParams(pageSize, pageToken, contextType),
      }),
    )
    return buildAipPage(data, 'contextItems', parseContextItem, (token) =>
      this.listPage(pageSize, token, contextType),
    )
  }

  /**
   * Retrieve one context item by uid.
   *
   * @param uid - Context item uid.
   * @returns The context item.
   */
  async get(uid: string): Promise<ContextItem> {
    const data = await invokeWithRetry(this.config, this.http, 'ContextItemsController_get', {
      pathParams: { uid },
    })
    return parseContextItem(data)
  }

  /**
   * Update a context item.
   *
   * Only the fields you pass are changed. To clear a field, name it in
   * `updateMask` and leave its argument unset.
   *
   * @param uid - Context item uid.
   * @param options.content - Replacement type-specific content.
   * @param options.contextType - Item type (for example `"note"`). Required when `content` is supplied.
   * @param options.description - New description.
   * @param options.userFeedback - Feedback verdict: `"positive"`, `"neutral"`, or `"negative"`.
   * @param options.topics - Replacement topic tags. Pass `[]` to clear all tags.
   * @param options.updateMask - Comma-separated field names to update or clear.
   * @returns The updated context item.
   */
  async update(
    uid: string,
    options: {
      content?: unknown
      contextType?: string
      description?: string
      userFeedback?: UserFeedback
      topics?: string[]
      updateMask?: string
    } = {},
  ): Promise<ContextItem> {
    const body =
      options.updateMask !== undefined
        ? {
            content: options.content,
            contextType: options.contextType,
            description: options.description,
            userFeedback: options.userFeedback,
            topics: options.topics,
          }
        : omitUndefined({
            content: options.content,
            contextType: options.contextType,
            description: options.description,
            userFeedback: options.userFeedback,
            topics: options.topics,
          })
    await invokeWithRetry(this.config, this.http, 'ContextItemsController_update', {
      pathParams: { uid },
      query: updateMaskQuery(options.updateMask),
      jsonBody: body,
    })
    return this.get(uid)
  }

  /**
   * Delete a context item.
   *
   * @param uid - Context item uid.
   * @returns Deletion confirmation details.
   */
  async delete(uid: string): Promise<ContextItemDeletion> {
    const data = await invokeWithRetry(this.config, this.http, 'ContextItemsController_delete', {
      pathParams: { uid },
    })
    return data as ContextItemDeletion
  }
}
