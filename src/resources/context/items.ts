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
  filters: ListContextItemsFilters = {},
): Record<string, string | number | boolean | readonly string[] | undefined | null> {
  const extra: Record<string, string | readonly string[]> = {}
  if (filters.contextType !== undefined) extra.contextTypes = [filters.contextType]
  if (filters.parentUids !== undefined) {
    extra.parentUids = filters.parentUids.length === 0 ? '' : [...filters.parentUids]
  }
  if (filters.ancestorUids !== undefined) {
    extra.ancestorUids = filters.ancestorUids.length === 0 ? '' : [...filters.ancestorUids]
  }
  if (filters.connectionIds !== undefined) {
    extra.connectionIds = filters.connectionIds.length === 0 ? '' : [...filters.connectionIds]
  }
  return aipListParams(pageSize, pageToken, extra) as Record<
    string,
    string | number | boolean | readonly string[] | undefined | null
  >
}

type ListContextItemsFilters = {
  contextType?: string
  parentUids?: readonly string[]
  ancestorUids?: readonly string[]
  connectionIds?: readonly string[]
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
 * Read the org knowledge base (notes, metrics, saved queries, integration items).
 *
 * Use `client.context.items` after `new Modus()`. Prefer `list` / `get` /
 * `lookup` for discovery; use `listValues` when a field holds a large array
 * inside `content`.
 *
 * @example
 * ```ts
 * import { Modus } from '@getmodus/sdk'
 * const client = new Modus()
 * for await (const item of (await client.context.items.list({ pageSize: 25 })).autoPagingIter()) {
 *   console.log(item.contextType, item.description ?? item.uid)
 * }
 * ```
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
   * @param options.contextType - Filter to a single context type (e.g. `"note"`).
   * @param options.parentUids - Exact ordered native ancestry chain for direct
   *   children. Omit to leave parent unrestricted; pass `[]` for the known-empty
   *   root. Native UIDs are exact tokens (including whitespace); do not use the
   *   hashed context-item `uid`. For a folder's children, send that item's
   *   `ancestry` UIDs plus its last `dataPath` token.
   * @param options.ancestorUids - Ordered UID ancestry prefix for strict
   *   descendants. Omit to leave unrestricted; pass `[]` for every item with
   *   non-null ancestry.
   * @param options.connectionIds - Restrict to these connection ids. Omit to
   *   leave unfiltered; pass `[]` to match none. The Files root is
   *   `connectionIds: ['files']` with `parentUids: []`.
   * @returns A page of context items — use `.autoPagingIter()` for all pages.
   *
   * @example
   * ```ts
   * const notes = await client.context.items.list({ contextType: 'note', pageSize: 50 })
   * for (const item of notes.items) {
   *   console.log(item.description ?? item.uid, item.uid)
   * }
   * ```
   *
   * @example
   * ```ts
   * const rootFolders = await client.context.items.list({
   *   connectionIds: ['files'],
   *   contextType: 'file_folder_metadata',
   *   parentUids: [],
   * })
   * const folder = rootFolders.items[0]
   * const nativeUid = folder?.dataPath?.at(-1)
   * // Known ancestry only — never treat null/omitted ancestry as a root chain.
   * if (folder?.ancestry != null && nativeUid !== undefined) {
   *   const filesInFolder = await client.context.items.list({
   *     connectionIds: ['files'],
   *     contextType: 'file_upload',
   *     parentUids: [...folder.ancestry.map((a) => a.uid), nativeUid],
   *   })
   * }
   * ```
   */
  list(options: {
    pageSize?: number
    pageToken?: string
    contextType?: string
    parentUids?: readonly string[]
    ancestorUids?: readonly string[]
    connectionIds?: readonly string[]
  } = {}): Promise<Page<ContextItem>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken, {
      contextType: options.contextType,
      parentUids: options.parentUids,
      ancestorUids: options.ancestorUids,
      connectionIds: options.connectionIds,
    })
  }

  private async listPage(
    pageSize: number,
    pageToken: string | undefined,
    filters: ListContextItemsFilters,
  ): Promise<Page<ContextItem>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ContextItemsController_list', {
        query: contextListParams(pageSize, pageToken, filters),
      }),
    )
    return buildAipPage(data, 'contextItems', parseContextItem, (token) =>
      this.listPage(pageSize, token, filters),
    )
  }

  /**
   * Retrieve a knowledge-base item by uid.
   *
   * @param uid - Item uid.
   * @returns The context item (`uid`, `contextType`, `content`, …).
   * @throws {NotFoundError} When no item matches the uid.
   *
   * @example
   * ```ts
   * const item = await client.context.items.get(uid)
   * console.log(item.contextType, item.description ?? item.uid)
   * ```
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
   * @param options.contextType - Context type to match (e.g. `"note"`).
   * @param options.dataPath - Hierarchical path segments that identify the item.
   * @param options.contentProjection - Optional fields to include from item content.
   * @returns The matching row, or `undefined` when no item is found (404).
   *
   * @example
   * ```ts
   * const found = await client.context.items.lookup({
   *   contextType: 'note',
   *   dataPath: ['finance', 'arr-definition'],
   * })
   * if (found) console.log(found.uid, found.description ?? found.uid)
   * ```
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
   * @param contentKeyPath - Dot path to the value field inside item content (e.g. `"enumValues"`).
   * @param options.pageSize - Maximum items per page (default 25).
   * @param options.pageToken - Opaque token from a previous page.
   * @returns A page of value rows.
   *
   * @example
   * ```ts
   * // Replace PLACEHOLDER_UID with a real uid whose content has enumValues.
   * const page = await client.context.items.listValues(
   *   'PLACEHOLDER_UID',
   *   'table_column',
   *   'enumValues',
   *   { pageSize: 25 },
   * )
   * for (const row of page.items) console.log(row)
   * ```
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
   *
   * @example
   * ```ts
   * // Replace PLACEHOLDER_UID with a real uid that has enumValues in content.
   * const item = await client.context.items.get('PLACEHOLDER_UID')
   * const page = await client.context.items.listValuesFor(item, 'enumValues')
   * for (const row of page.items) console.log(row)
   * ```
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
