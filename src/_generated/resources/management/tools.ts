// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../_config.js'
import type { HttpClient } from '../../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../../_pagination.js'
import { asRecord, invokeWithRetry } from '../../../_request.js'
import { validatePageSize } from '../../../_validation.js'
import type { ToolCatalogEntry } from '../../../types/tools.js'

/** Generated base for the management `tools` resource. */
export class ToolsResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
  ) {}

  /**
   * List available tools.
   *
   * Returns a page of known tool/integration surfaces a scope can select in its toolset, with the
   * fixed actions for built-in tools.
   *
   * **Requires:** `scopes:read`
   *
   * @param options.pageSize - Items per page. Defaults to 25.
   * @param options.pageToken - Opaque page token from a previous response's `nextPageToken`. Omit
   *   for the first page.
   * @returns A page of tools.
   */
  list(options: {
    pageSize?: number
    pageToken?: string
  } = {}): Promise<Page<ToolCatalogEntry>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken)
  }

  protected async listPage(
    pageSize: number,
    pageToken: string | undefined,
  ): Promise<Page<ToolCatalogEntry>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ToolsController_list', {
        query: aipListParams(pageSize, pageToken) as Record<
          string,
          string | number | boolean | undefined | null
        >,
      }),
    )
    return buildAipPage(
      data,
      'tools',
      (raw) => raw as ToolCatalogEntry,
      (token) => this.listPage(pageSize, token),
    )
  }
}
