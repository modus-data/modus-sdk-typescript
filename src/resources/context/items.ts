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

/**
 * Read access to Modus knowledge-base items.
 */
export class ContextItemsResource {
  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  /**
   * List knowledge-base items.
   *
   * @param options.pageSize - Maximum items per page (default 25).
   * @param options.pageToken - Opaque token from a previous page.
   * @param options.contextType - Filter to a single context type.
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
   * Retrieve a knowledge-base item by uid.
   *
   * @param uid - Item uid.
   * @returns The context item.
   * @throws {NotFoundError} When no item matches the uid.
   */
  async get(uid: string): Promise<ContextItem> {
    const data = await invokeWithRetry(this.config, this.http, 'ContextItemsController_get', {
      pathParams: { uid },
    })
    return parseContextItem(data)
  }

  /**
   * Look up a knowledge-base item by type and data path.
   *
   * @param options.contextType - Context type to match.
   * @param options.dataPath - Hierarchical path segments that identify the item.
   * @param options.contentProjection - Optional fields to include from item content.
   * @returns The matching row, or `undefined` when no item is found (404).
   */
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

  /**
   * List values stored under a content key on a context item.
   *
   * @param uid - Item uid.
   * @param contextType - Context type of the item.
   * @param contentKeyPath - Dot path to the value field inside item content.
   * @param options.pageSize - Maximum items per page (default 25).
   * @param options.pageToken - Opaque token from a previous page.
   * @returns A page of value rows.
   */
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

  /**
   * List values for a context item already loaded via {@link ContextItemsResource.list} or {@link ContextItemsResource.get}.
   *
   * @param item - Context item (uses `item.uid` and `item.contextType`).
   * @param contentKeyPath - Dot path to the value field inside item content.
   * @param options.pageSize - Maximum items per page (default 25).
   * @param options.pageToken - Opaque token from a previous page.
   * @returns A page of value rows.
   */
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
