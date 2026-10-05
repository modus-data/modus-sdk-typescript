import type { OperationId } from '../../_generated/operations.js'
import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { updateMaskQuery } from '../../_query.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../../_request.js'
import { validatePageSize } from '../../_validation.js'
import type { ContextItem, ContextItemDeletion, ContextItemMove } from '../../types/context.js'
import type { UserFeedback } from './_content-merge.js'

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
   * @param options.parentUids - Exact ordered native ancestry chain for direct
   *   children. Omit to leave parent unrestricted; pass `[]` for the known-empty
   *   root. Native UIDs are exact tokens; for a folder's children send ancestry
   *   UIDs plus the last `dataPath` token, not the hashed context-item `uid`.
   * @param options.ancestorUids - Ordered UID ancestry prefix for strict
   *   descendants. Omit to leave unrestricted; pass `[]` for every item with
   *   non-null ancestry.
   * @param options.connectionIds - Restrict to these connection ids. Omit to
   *   leave unfiltered; pass `[]` to match none. The Files root is
   *   `connectionIds: ['files']` with `parentUids: []`.
   * @returns A page of context items.
   *
   * @example
   * ```ts
   * const rootFiles = await mgmt.context.items.list({
   *   connectionIds: ['files'],
   *   contextType: 'file_upload',
   *   parentUids: [],
   * })
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
   * Delete a context item. Deleting a Files folder also deletes all its contents.
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

  /**
   * Move a live file or Files folder.
   *
   * Pass `destinationFolderUid: null` to move to the Files root. The
   * destination folder must already exist. Same-parent moves succeed as a
   * no-op. Does not rename or merge folders.
   *
   * @param uid - Stored context-item uid of the file or folder to move.
   * @param options.destinationFolderUid - Stored context-item uid of the
   *   destination folder, or `null` for the Files root.
   * @returns How many items changed parent (`0` is a successful no-op).
   * @throws {NotFoundError} The source is missing or not visible.
   * @throws {ModusError} The destination is missing, not a Files folder, or
   *   the move would create a cycle (HTTP 400).
   * @throws {PermissionDeniedError} The destination exists but is not writable
   *   for this caller.
   * @throws {ConflictError} A sibling with the same name already exists.
   *
   * @example
   * ```ts
   * const moved = await mgmt.context.items.move('PLACEHOLDER_UID', {
   *   destinationFolderUid: 'PLACEHOLDER_FOLDER_UID',
   * })
   * console.log(moved.movedItems)
   * ```
   */
  async move(
    uid: string,
    options: { destinationFolderUid: string | null },
  ): Promise<ContextItemMove> {
    const data = await invokeWithRetry(
      this.config,
      this.http,
      'ContextItemsController_move' as OperationId,
      {
        pathParams: { uid },
        jsonBody: { destinationFolderUid: options.destinationFolderUid },
      },
    )
    return data as ContextItemMove
  }
}
