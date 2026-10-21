import { ConnectionsResourceBase } from '../_generated/resources/consumption/connections.js'
import { validatePageSize } from '../_validation.js'
import type { Connection } from '../types/connections.js'

/**
 * Read access to integration connections.
 */
export class ConnectionsResource extends ConnectionsResourceBase {
  /**
   * Find the first connection whose name matches (case-insensitive).
   *
   * Pages through {@link ConnectionsResource.list} until a match is found.
   *
   * @param options.name - Connection name to search for.
   * @param options.type - Optional integration category filter.
   * @param options.pageSize - Page size when scanning (default 25).
   * @returns The matching connection, or `undefined` if none is found.
   */
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
