import type { ModusConfig } from '../../_config.js'
import { NotFoundError } from '../../_exceptions.js'
import type { HttpClient } from '../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../../_request.js'
import { DEFAULT_MAX_PAGE_SIZE, validatePageSize } from '../../_validation.js'
import type { ContextItem, ContextItemLookupRow } from '../../types/context.js'
import type { ContextValueRow } from '../../types/context-values.js'
import type { ContentProjection, JsonObjectInput } from '../../types/json-blob.js'

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

function parseContextValueRow(raw: unknown): ContextValueRow {
  return raw as ContextValueRow
}

function parseLookupResponse(raw: Record<string, unknown>): ContextItemLookupRow | undefined {
  const item = raw.item
  if (item === null || item === undefined) return undefined
  return item as ContextItemLookupRow
}

export class ContextItemsResource {
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

  async lookup(options: {
    contextType: string
    dataPath: string[]
    contentProjection?: JsonObjectInput | ContentProjection
  }): Promise<ContextItemLookupRow | undefined> {
    const body = omitUndefined({
      contextType: options.contextType,
      dataPath: options.dataPath,
      contentProjection: options.contentProjection,
    })
    try {
      const raw = asRecord(
        await invokeWithRetry(this.config, this.http, 'ContextItemsController_lookup', {
          jsonBody: body,
        }),
      )
      return parseLookupResponse(raw)
    } catch (error) {
      if (error instanceof NotFoundError) return undefined
      throw error
    }
  }

  listValues(
    uid: string,
    contextType: string,
    contentKeyPath: string,
    options: { pageSize?: number; pageToken?: string } = {},
  ): Promise<Page<ContextValueRow>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize, DEFAULT_MAX_PAGE_SIZE)
    return this.listValuesPage(uid, contextType, contentKeyPath, pageSize, options.pageToken)
  }

  listValuesFor(
    item: ContextItem,
    contentKeyPath: string,
    options: { pageSize?: number; pageToken?: string } = {},
  ): Promise<Page<ContextValueRow>> {
    return this.listValues(item.uid, item.contextType, contentKeyPath, options)
  }

  private async listValuesPage(
    uid: string,
    contextType: string,
    contentKeyPath: string,
    pageSize: number,
    pageToken: string | undefined,
  ): Promise<Page<ContextValueRow>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ContextItemsController_listValues', {
        pathParams: { uid },
        query: aipListParams(pageSize, pageToken, {
          contextType,
          contentKeyPath,
        }) as Record<string, string | number | boolean | undefined | null>,
      }),
    )
    return buildAipPage(data, 'values', parseContextValueRow, (token) =>
      this.listValuesPage(uid, contextType, contentKeyPath, pageSize, token),
    )
  }
}
