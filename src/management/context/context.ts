import type { OperationId } from '../../_generated/operations.js'
import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { invokeWithRetry, omitUndefined } from '../../_request.js'
import type { ContextItem, CreatedContextItem } from '../../types/context.js'
import {
  resolveAndUpdateLink,
  resolveAndUpdateNote,
  resolveAndUpdateSavedQuery,
  type UserFeedback,
} from './_content-merge.js'
import { ManagementContextItemsResource } from './items.js'

export class ManagementContextResource {
  readonly items: ManagementContextItemsResource

  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {
    this.items = new ManagementContextItemsResource(http, config)
  }

  private async create(operationId: OperationId, payload: Record<string, unknown>): Promise<CreatedContextItem> {
    const data = await invokeWithRetry(this.config, this.http, operationId, {
      jsonBody: payload,
    })
    return data as CreatedContextItem
  }

  createNote(title: string, content: string): Promise<CreatedContextItem> {
    return this.create('ContextCreatorsController_createNote', omitUndefined({ title, content }))
  }

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
}

export type { UserFeedback } from './_content-merge.js'
