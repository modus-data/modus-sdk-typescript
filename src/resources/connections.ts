import { ConnectionsResourceBase } from '../_generated/resources/consumption/connections.js'
import { aipListParams, buildAipPage, type Page } from '../_pagination.js'
import { asRecord, invokeWithRetry } from '../_request.js'
import { validateId, validatePageSize } from '../_validation.js'
import type { Connection, ConnectionSelection } from '../types/connections.js'

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

  /**
   * List the selectable units on a connection (a repository, a schema, a project).
   *
   * @param connectionId - Connection id.
   * @param options.pageSize - Maximum items per page (default 25).
   * @param options.pageToken - Opaque token from a previous page.
   * @returns A page of selectable units — use {@link iterSelections} or `.autoPagingIter()` for every page.
   * @example
   * for await (const unit of client.connections.iterSelections('7a3f9d2c-1111-4000-a000-000000000abc')) {
   *   console.log(unit.objectType, unit.path)
   * }
   */
  listSelections(
    connectionId: string,
    options: { pageSize?: number; pageToken?: string } = {},
  ): Promise<Page<ConnectionSelection>> {
    validateId(connectionId, 'connection_id')
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listSelectionsPage(connectionId, pageSize, options.pageToken)
  }

  private async listSelectionsPage(
    connectionId: string,
    pageSize: number,
    pageToken: string | undefined,
  ): Promise<Page<ConnectionSelection>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ConnectionsController_listSelections', {
        pathParams: { connectionId },
        query: aipListParams(pageSize, pageToken) as Record<
          string,
          string | number | boolean | undefined | null
        >,
      }),
    )
    return buildAipPage(
      data,
      'selections',
      (raw) => raw as ConnectionSelection,
      (token) => this.listSelectionsPage(connectionId, pageSize, token),
    )
  }

  /**
   * Yield every selectable unit on a connection, following pages.
   *
   * @param connectionId - Connection id.
   * @param options.pageSize - Maximum items per page (default 25).
   * @example
   * for await (const unit of client.connections.iterSelections('7a3f9d2c-1111-4000-a000-000000000abc')) {
   *   console.log(unit.objectType, unit.displayName)
   * }
   */
  async *iterSelections(
    connectionId: string,
    options: { pageSize?: number } = {},
  ): AsyncGenerator<ConnectionSelection> {
    const page = await this.listSelections(connectionId, options)
    yield* page.autoPagingIter()
  }
}
