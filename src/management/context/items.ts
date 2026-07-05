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

  async get(uid: string): Promise<ContextItem> {
    const data = await invokeWithRetry(this.config, this.http, 'ContextItemsController_get', {
      pathParams: { uid },
    })
    return parseContextItem(data)
  }

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

  async delete(uid: string): Promise<ContextItemDeletion> {
    const data = await invokeWithRetry(this.config, this.http, 'ContextItemsController_delete', {
      pathParams: { uid },
    })
    return data as ContextItemDeletion
  }
}
