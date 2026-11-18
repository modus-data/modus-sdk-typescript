import type { ModusConfig } from '../../_config.js'
import { ValidationError } from '../../_exceptions.js'
import type { components } from '../../_generated/v1.js'
import type { HttpClient } from '../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../../_request.js'
import { validatePageSize } from '../../_validation.js'
import type { ContextItem } from '../../types/context.js'

export type CustomContextItemKind =
  | 'source'
  | 'collection'
  | 'entity'
  | 'field'
  | 'entity_samples'

export interface CustomAttributeInput {
  name: string
  dataType?: string
  value?: unknown
}

export interface CreateCustomContextItemInput {
  kind: CustomContextItemKind
  sourceId: string
  sourceName?: string
  collectionId?: string
  collectionName?: string
  externalId?: string
  fieldName?: string
  name?: string
  entityType?: string
  description?: string
  content?: unknown
  url?: string
  attributes?: CustomAttributeInput[]
  dataType?: string
  value?: unknown
  samples?: unknown[]
  raw?: Record<string, unknown>
  topics?: string[]
  idempotencyKey?: string
  /** Who can see the item; omitted, everyone in the organization. Fixed at creation: delete and re-create the item to change it. */
  access?: components['schemas']['AccessPolicyDto']
}

export type UpdateCustomContextItemInput = Omit<
  Partial<CreateCustomContextItemInput>,
  | 'kind'
  | 'sourceId'
  | 'sourceName'
  | 'collectionId'
  | 'collectionName'
  | 'externalId'
  | 'fieldName'
  | 'idempotencyKey'
  | 'access'
>

export interface CustomContextItemRelationInput {
  fromUid: string
  toUid: string
  relationType: string
  edgeProperties?: Record<string, string | number | boolean | Array<string | number | boolean>>
}

export interface CreatedCustomContextItem {
  contextItemId: string
  /** Same value as ``contextItemId`` — prefer this in new code (list/get parity). */
  uid: string
  contextType: string
  /**
   * Canonical address of the represented object in the custom platform hierarchy.
   * This is distinct from `uid`: multiple context representations of one object,
   * such as `entity` and `entity_samples`, share a data path.
   */
  dataPath: string[]
  title: string | null
}

export interface CustomContextItemDeletion {
  uid: string
  contextType: string
}

export interface BatchDeleteCustomContextItemsInput {
  /** Customer-defined source to delete from. Required. */
  sourceId: string
  /** Narrow to one collection inside the source. */
  collectionId?: string
  /** Narrow to one entity inside the collection. Requires `collectionId`. */
  externalId?: string
  /**
   * Which kind to delete at the selected path, for a non-cascade delete — an
   * entity and its `entity_samples` share a path, so this disambiguates them.
   * Defaults to the metadata item at the selected level. Ignored when `cascade`.
   */
  kind?: CustomContextItemKind
  /** When true, also delete everything beneath the targeted node; default deletes only the targeted node. */
  cascade?: boolean
  /** Continuation cursor from a previous response `nextCursor`. */
  cursor?: string
}

export interface BatchDeleteCustomContextItemsResult {
  /** Number of custom context items soft-deleted by this request. */
  deletedCount: number
  /** True when more matching items were ahead of this batch; call again with `nextCursor`. */
  truncated: boolean
  /**
   * Continuation cursor; pass as `cursor` to delete the next batch. `null` means no more matching
   * items were ahead at scan time — this is a forward pass, not a snapshot, so items added (or
   * recreated with a lower id) during the sweep may be missed; run a fresh pass (no cursor) to catch them.
   */
  nextCursor: string | null
}

function parseContextItem(raw: unknown): ContextItem {
  return raw as ContextItem
}

function parseCreatedCustomContextItem(raw: unknown): CreatedCustomContextItem {
  const data = asRecord(raw)
  const contextItemId = data.contextItemId
  if (typeof contextItemId !== 'string' || !contextItemId) {
    throw new ValidationError(
      'Custom context create response missing non-empty string contextItemId',
    )
  }
  return {
    ...(data as Omit<CreatedCustomContextItem, 'uid' | 'contextItemId'>),
    contextItemId,
    uid: contextItemId,
  }
}

function parseDeletion(raw: unknown): CustomContextItemDeletion {
  return raw as CustomContextItemDeletion
}

/**
 * Create, update, and delete custom context items.
 *
 * The stable IDs supplied on create define each item's canonical `dataPath`:
 *
 * - `source`: `['custom', sourceId]`
 * - `collection`: `['custom', sourceId, collectionId]`
 * - `entity` and `entity_samples`:
 *   `['custom', sourceId, collectionId, externalId]`
 * - `field`: `['custom', sourceId, collectionId, externalId, fieldName]`
 *
 * A data path identifies the represented object in the custom platform; `uid`
 * identifies a stored context row. Consequently, an entity and its samples row
 * share a data path but have different UIDs.
 *
 * The API derives `dataPath` and `ancestry`; do not send either field. Ancestry is
 * the ordered chain of parent platform IDs, excluding the virtual `custom` root
 * and the item's own final path segment. For example, an entity's ancestry is
 * `[sourceId, collectionId]`.
 *
 * Creating a child does not create its parent rows. To make the hierarchy
 * traversable, create the `source`, then the `collection`, then the `entity`, and
 * finally any `field` or `entity_samples` rows, repeating the same parent IDs at
 * every level.
 *
 * Writes (`create`, `batchCreate`, `createRelations`, `update`, `delete`) are off
 * by default for each organization: until Modus enables them, they reject with a
 * `PermissionDeniedError` whose message is `Custom context item writes are not
 * enabled`. Reads (`list`, `get`) always work.
 */
export class CustomContextItemsResource {
  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  /**
   * List custom context items.
   *
   * @param options.pageSize - Maximum items per page (default 25).
   * @param options.pageToken - Opaque token from a previous page.
   * @param options.searchQuery - Word search: returns rows that contain every word of the query, case-insensitive.
   * @param options.topics - Filter to items tagged with any of these topics.
   * @param options.sourceId - Restrict to one customer-defined source and everything beneath it.
   * @param options.collectionId - Restrict to one collection inside the source. Requires `sourceId`.
   * @param options.externalId - Restrict to one entity inside the collection. Requires `sourceId` and `collectionId`.
   * @returns A page of custom context items.
   * @example
   * ```ts
   * const client = new Modus()
   * const page = await client.context.customItems.list({ sourceId: 'billing-db' })
   * for (const item of page.items) console.log(item.uid, item.contextType)
   * ```
   */
  list(options: {
    pageSize?: number
    pageToken?: string
    searchQuery?: string
    topics?: string[]
    sourceId?: string
    collectionId?: string
    externalId?: string
  } = {}): Promise<Page<ContextItem>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken, options)
  }

  private async listPage(
    pageSize: number,
    pageToken: string | undefined,
    options: {
      searchQuery?: string
      topics?: string[]
      sourceId?: string
      collectionId?: string
      externalId?: string
    },
  ): Promise<Page<ContextItem>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'CustomContextItemsController_list', {
        query: aipListParams(pageSize, pageToken, {
          searchQuery: options.searchQuery,
          topics: options.topics,
          sourceId: options.sourceId,
          collectionId: options.collectionId,
          externalId: options.externalId,
        }) as Record<string, string | number | boolean | readonly string[] | undefined | null>,
      }),
    )
    return buildAipPage(data, 'contextItems', parseContextItem, (token) =>
      this.listPage(pageSize, token, options),
    )
  }

  /**
   * Retrieve a custom context item by uid.
   *
   * @param uid - Item uid.
   * @returns The custom context item.
   * @throws {NotFoundError} When no item matches the uid.
   * @example
   * ```ts
   * const client = new Modus()
   * const item = await client.context.customItems.get('PLACEHOLDER_UID')
   * ```
   */
  async get(uid: string): Promise<ContextItem> {
    return parseContextItem(
      await invokeWithRetry(this.config, this.http, 'CustomContextItemsController_get', {
        pathParams: { uid },
      }),
    )
  }

  /**
   * Create a custom context item.
   *
   * @param input.kind - Item kind (`source`, `collection`, `entity`, `field`, or `entity_samples`).
   * @param input.sourceId - Source identifier for the item hierarchy.
   * @param input.name - Display name when applicable.
   * @param input.content - Item payload.
   * @param input.idempotencyKey - Optional idempotency key for safe retries.
   * @returns Created item ids and hierarchy metadata.
   *
   * @example
   * ```ts
   * const client = new Modus()
   * // Create the source and collection first, or use batchCreate as shown below.
   * const created = await client.context.customItems.create({
   *   kind: 'entity',
   *   sourceId: 'billing-db',
   *   collectionId: 'contracts',
   *   externalId: 'contract-123',
   *   name: 'Q3 churn notes',
   *   content: { summary: 'Key findings…' },
   * })
   * console.log(created.uid, created.dataPath)
   * ```
   */
  async create(input: CreateCustomContextItemInput): Promise<CreatedCustomContextItem> {
    return parseCreatedCustomContextItem(
      await invokeWithRetry(this.config, this.http, 'CustomContextItemsController_create', {
        jsonBody: omitUndefined(input as unknown as Record<string, unknown>),
      }),
    )
  }

  /**
   * Create multiple custom context items in one request.
   *
   * @param inputs - Items to create (same fields as {@link CustomContextItemsResource.create}).
   * @returns Created item metadata for each input.
   *
   * @example
   * ```ts
   * const client = new Modus()
   * const created = await client.context.customItems.batchCreate([
   *   { kind: 'source', sourceId: 'billing-db', name: 'Billing database' },
   *   {
   *     kind: 'collection',
   *     sourceId: 'billing-db',
   *     collectionId: 'contracts',
   *     name: 'Contracts',
   *   },
   *   {
   *     kind: 'entity',
   *     sourceId: 'billing-db',
   *     collectionId: 'contracts',
   *     externalId: 'contract-123',
   *     name: 'Acme renewal',
   *   },
   * ])
   * console.log(created.map((item) => item.dataPath))
   * ```
   */
  async batchCreate(inputs: CreateCustomContextItemInput[]): Promise<CreatedCustomContextItem[]> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'CustomContextItemsController_batchCreate', {
        jsonBody: {
          items: inputs.map((input) => omitUndefined(input as unknown as Record<string, unknown>)),
        },
      }),
    )
    const items = data.contextItems
    return Array.isArray(items) ? items.map(parseCreatedCustomContextItem) : []
  }

  /**
   * Create or update typed relations between context items.
   *
   * @param relations - Relations with source and target item uids, a snake_case type, and optional flat edgeProperties. Omitting edgeProperties on an existing relation replaces its stored properties with `{}`.
   * @returns Number of relations created or updated.
   * @example
   * ```ts
   * const client = new Modus()
   * await client.context.customItems.createRelations([{
   *   fromUid: 'SOURCE_UID',
   *   toUid: 'TARGET_UID',
   *   relationType: 'depends_on',
   *   edgeProperties: { source_file: 'go.mod' },
   * }])
   * ```
   */
  async createRelations(relations: CustomContextItemRelationInput[]): Promise<number> {
    const data = asRecord(
      await invokeWithRetry(
        this.config,
        this.http,
        'CustomContextItemsController_createRelations',
        { jsonBody: { relations } },
      ),
    )
    return data.upsertedCount as number
  }

  /**
   * Update a custom context item.
   *
   * @param uid - Item uid.
   * @param input - Fields to change (kind and hierarchy ids cannot be changed).
   * @returns The updated item uid.
   * @example
   * ```ts
   * const client = new Modus()
   * await client.context.customItems.update('PLACEHOLDER_UID', {
   *   description: 'Updated summary',
   * })
   * ```
   */
  async update(uid: string, input: UpdateCustomContextItemInput): Promise<{ uid: string }> {
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'CustomContextItemsController_update', {
        pathParams: { uid },
        jsonBody: omitUndefined(input as unknown as Record<string, unknown>),
      }),
    ) as { uid: string }
  }

  /**
   * Delete a custom context item.
   *
   * @param uid - Item uid.
   * @returns Deletion confirmation with uid and context type.
   * @example
   * ```ts
   * const client = new Modus()
   * const result = await client.context.customItems.delete('PLACEHOLDER_UID')
   * ```
   */
  async delete(uid: string): Promise<CustomContextItemDeletion> {
    return parseDeletion(
      await invokeWithRetry(this.config, this.http, 'CustomContextItemsController_delete', {
        pathParams: { uid },
      }),
    )
  }

  /**
   * Delete custom context items selected by source key.
   *
   * Only items you can manage are deleted, and integration-derived context items
   * are never affected. By default only the targeted node is removed; set
   * `cascade` to also remove everything beneath it. Processes up to 1000 items
   * per call — when `truncated` is true, call again to continue.
   *
   * @param input.sourceId - Source to delete from. Required.
   * @param input.collectionId - Narrow to one collection inside the source.
   * @param input.externalId - Narrow to one entity inside the collection.
   * @param input.cascade - Also delete everything beneath the targeted node.
   * @returns Counts of deleted and skipped items, and whether more remain.
   * @example
   * ```ts
   * const client = new Modus()
   * const result = await client.context.customItems.batchDelete({
   *   sourceId: 'billing-db',
   *   collectionId: 'contracts',
   *   cascade: true,
   * })
   * console.log(result.deletedCount, result.truncated)
   * ```
   */
  async batchDelete(
    input: BatchDeleteCustomContextItemsInput,
  ): Promise<BatchDeleteCustomContextItemsResult> {
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'CustomContextItemsController_batchDelete', {
        jsonBody: omitUndefined(input as unknown as Record<string, unknown>),
      }),
    ) as unknown as BatchDeleteCustomContextItemsResult
  }
}
