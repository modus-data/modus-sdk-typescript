import type { ModusConfig } from '../_config.js'
import type { HttpClient } from '../_http.js'
import { aipListParams, buildAipPage, type Page } from '../_pagination.js'
import { asRecord, invokeWithRetry } from '../_request.js'
import { validatePageSize } from '../_validation.js'
import type { Connection } from '../types/connections.js'

function connectionsListParams(
  pageSize: number,
  pageToken: string | undefined,
  type?: string,
): Record<string, string | number | boolean | undefined | null> {
  const extra: Record<string, string | number | boolean | undefined | null> = {}
  if (type !== undefined) extra.type = type
  return aipListParams(pageSize, pageToken, extra) as Record<
    string,
    string | number | boolean | undefined | null
  >
}

function parseConnection(raw: unknown): Connection {
  return raw as Connection
}

export class ConnectionsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  list(options: {
    pageSize?: number
    pageToken?: string
    type?: string
  } = {}): Promise<Page<Connection>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken, options.type)
  }

  private async listPage(
    pageSize: number,
    pageToken: string | undefined,
    type?: string,
  ): Promise<Page<Connection>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ConnectionsController_list', {
        query: connectionsListParams(pageSize, pageToken, type),
      }),
    )
    return buildAipPage(data, 'connections', parseConnection, (token) =>
      this.listPage(pageSize, token, type),
    )
  }

  async find(options: {
    name: string
    type?: string
    pageSize?: number
  }): Promise<Connection | undefined> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    const target = options.name.trim().toLowerCase()
    let token: string | undefined
    do {
      const page = await this.listPage(pageSize, token, options.type)
      const match = page.items.find((c) => c.name?.toLowerCase() === target)
      if (match) return match
      if (!page.hasNextPage()) break
      token = page.nextPageToken
    } while (token !== undefined)
    return undefined
  }
}
