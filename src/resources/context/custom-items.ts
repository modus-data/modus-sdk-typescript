import type { ModusConfig } from '../../_config.js'
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

export interface CreatedCustomContextItem {
  contextItemId: string
  contextType: string
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
  return raw as CreatedCustomContextItem
}

function parseDeletion(raw: unknown): CustomContextItemDeletion {
  return raw as CustomContextItemDeletion
}

export class CustomContextItemsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

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

  async get(uid: string): Promise<ContextItem> {
    return parseContextItem(
      await invokeWithRetry(this.config, this.http, 'CustomContextItemsController_get', {
        pathParams: { uid },
      }),
    )
  }

  async create(input: CreateCustomContextItemInput): Promise<CreatedCustomContextItem> {
    return parseCreatedCustomContextItem(
      await invokeWithRetry(this.config, this.http, 'CustomContextItemsController_create', {
        jsonBody: omitUndefined(input as unknown as Record<string, unknown>),
      }),
    )
  }

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

  async update(uid: string, input: UpdateCustomContextItemInput): Promise<{ uid: string }> {
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'CustomContextItemsController_update', {
        pathParams: { uid },
        jsonBody: omitUndefined(input as unknown as Record<string, unknown>),
      }),
    ) as { uid: string }
  }

  async delete(uid: string): Promise<CustomContextItemDeletion> {
    return parseDeletion(
      await invokeWithRetry(this.config, this.http, 'CustomContextItemsController_delete', {
        pathParams: { uid },
      }),
    )
  }
}
