import type { OperationId } from '../../_generated/operations.js'
import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { invokeWithRetry, omitUndefined } from '../../_request.js'
import type { ContextItem, CreatedContextItem } from '../../types/context.js'
import { withCreatedUid } from '../../types/context.js'
import { CustomContextItemsResource } from '../../resources/context/custom-items.js'
import {
  resolveAndUpdateLink,
  resolveAndUpdateNote,
  resolveAndUpdateSavedQuery,
  type UserFeedback,
} from './_content-merge.js'
import { ManagementContextFilesResource } from './files.js'
import { ManagementContextItemsResource } from './items.js'

/**
 * Create and update context items (notes, links, saved queries, file uploads).
 *
 * Call path: `mgmt.context` after `new ModusManagement(...)`.
 */
export class ManagementContextResource {
  readonly items: ManagementContextItemsResource
  readonly customItems: CustomContextItemsResource
  readonly files: ManagementContextFilesResource

  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {
    this.items = new ManagementContextItemsResource(http, config)
    this.customItems = new CustomContextItemsResource(http, config)
    this.files = new ManagementContextFilesResource(http, config)
  }

  /**
   * Add a free-form text note to the knowledge base.
   *
   * @param title - Note title.
   * @param content - Note body (markdown).
   * @returns The created context item.
   * @example
   * ```ts
   * const note = await mgmt.context.createNote('Runbook', '# Steps\n1. Check logs')
   * ```
   */
  createNote(title: string, content: string): Promise<CreatedContextItem> {
    return this.create('ContextCreatorsController_createNote', omitUndefined({ title, content }))
  }

  /**
   * Update a note's title and markdown body.
   *
   * Preserves server-owned fields on the existing content blob. Pass `existing`
   * to skip a fetch when you already have the item from a list call.
   *
   * @param uid - Context item uid.
   * @param options.title - New title.
   * @param options.body - New markdown body.
   * @param options.existing - Optional cached item to avoid a GET.
   * @returns The updated context item.
   */
  updateNote(
    uid: string,
    options: {
      title: string
      body: string
      existing?: ContextItem
      description?: string
      userFeedback?: UserFeedback
      topics?: string[]
    },
  ): Promise<ContextItem> {
    return resolveAndUpdateNote(this.items, uid, options)
  }

  /**
   * Save a SQL query to the knowledge base.
   *
   * @param name - Display name for the query.
   * @param options.connectionId - Connection the query runs against.
   * @param options.query - SQL text.
   * @param options.path - Optional hierarchy path segments.
   * @returns The created context item.
   */
  createSavedQuery(
    name: string,
    options: {
      query?: string
      connectionId: string
      description?: string
      path?: string[]
    },
  ): Promise<CreatedContextItem> {
    return this.create(
      'ContextCreatorsController_createSavedQuery',
      omitUndefined({
        name,
        query: options.query,
        connectionId: options.connectionId,
        description: options.description,
        path: options.path,
      }),
    )
  }

  /**
   * Update a saved query's name, SQL, and optional connection metadata.
   *
   * @param uid - Context item uid.
   * @param options.name - New display name.
   * @param options.query - New SQL text.
   * @param options.existing - Optional cached item to avoid a GET.
   * @returns The updated context item.
   */
  updateSavedQuery(
    uid: string,
    options: {
      name: string
      query: string
      connectionId?: string
      path?: string[]
      existing?: ContextItem
      description?: string
      userFeedback?: UserFeedback
      topics?: string[]
    },
  ): Promise<ContextItem> {
    return resolveAndUpdateSavedQuery(this.items, uid, options)
  }

  /**
   * Add a URL to the knowledge base.
   *
   * @param url - Link URL.
   * @param options.title - Optional display title.
   * @param options.isCrawl - When true, crawl linked pages into context.
   * @param options.pageLimit - Maximum pages to crawl when `isCrawl` is true.
   * @returns The created context item.
   */
  createLink(
    url: string,
    options: { title?: string; isCrawl?: boolean; pageLimit?: number } = {},
  ): Promise<CreatedContextItem> {
    return this.create(
      'ContextCreatorsController_createLink',
      omitUndefined({
        url,
        title: options.title,
        isCrawl: options.isCrawl,
        pageLimit: options.pageLimit,
      }),
    )
  }

  /**
   * Update link metadata on an existing item.
   *
   * Merges `title` and/or `url` into the stored content blob. Does not re-fetch or re-crawl the URL.
   *
   * @param uid - Context item uid.
   * @param options.title - New display title.
   * @param options.url - New URL.
   * @param options.existing - Optional cached item to avoid a GET.
   * @returns The updated context item.
   */
  updateLink(
    uid: string,
    options: {
      title?: string
      url?: string
      existing?: ContextItem
      description?: string
      userFeedback?: UserFeedback
      topics?: string[]
    },
  ): Promise<ContextItem> {
    return resolveAndUpdateLink(this.items, uid, options)
  }

  /** @internal */
  private async create(operationId: OperationId, payload: Record<string, unknown>): Promise<CreatedContextItem> {
    const data = await invokeWithRetry(this.config, this.http, operationId, {
      jsonBody: payload,
    })
    return withCreatedUid(data as Parameters<typeof withCreatedUid>[0])
  }
}

export type { UserFeedback } from './_content-merge.js'
