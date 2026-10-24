import type { ModusConfig } from '../../_config.js'
import { ValidationError } from '../../_exceptions.js'
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
}

export type UpdateCustomContextItemInput = Omit<
  Partial<CreateCustomContextItemInput>,
  'kind' | 'sourceId' | 'sourceName' | 'collectionId' | 'collectionName' | 'externalId' | 'fieldName' | 'idempotencyKey'
>

export interface CustomContextItemRelationInput {
  fromUid: string
  toUid: string
  relationType: string
  content?: Record<string, unknown>
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
   * @returns A page of custom context items.
   * @example
   * ```ts
   * const client = new Modus()
   * const page = await client.context.customItems.list({ pageSize: 25 })
   * for (const item of page.items) console.log(item.uid, item.contextType)
   * ```
   */
  list(options: {
    pageSize?: number
    pageToken?: string
    searchQuery?: string
    topics?: string[]
  } = {}): Promise<Page<ContextItem>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken, options)
  }

  private async listPage(
    pageSize: number,
    pageToken: string | undefined,
    options: { searchQuery?: string; topics?: string[] },
  ): Promise<Page<ContextItem>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'CustomContextItemsController_list', {
        query: aipListParams(pageSize, pageToken, {
          searchQuery: options.searchQuery,
          topics: options.topics,
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
   * @param relations - Relations with source and target item uids, a snake_case type, and optional content.
   * @returns Number of relations created or updated.
   * @example
   * ```ts
   * const client = new Modus()
   * await client.context.customItems.createRelations([{
   *   fromUid: 'SOURCE_UID',
   *   toUid: 'TARGET_UID',
   *   relationType: 'depends_on',
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
}
