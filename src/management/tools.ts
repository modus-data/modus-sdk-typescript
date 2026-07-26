import type { ModusConfig } from '../_config.js'
import type { HttpClient } from '../_http.js'
import { asRecord, invokeWithRetry } from '../_request.js'
import { aipListParams, buildAipPage, type Page } from '../_pagination.js'
import { validatePageSize } from '../_validation.js'
import type { ToolCatalogEntry } from '../types/tools.js'

function parseToolCatalogEntry(raw: unknown): ToolCatalogEntry {
  return raw as ToolCatalogEntry
}

export class ManagementToolsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  list(options: { pageSize?: number; pageToken?: string } = {}): Promise<Page<ToolCatalogEntry>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(pageSize, options.pageToken)
  }

  private async listPage(pageSize: number, pageToken: string | undefined): Promise<Page<ToolCatalogEntry>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'ToolsController_list', {
        query: aipListParams(pageSize, pageToken) as Record<string, string | number | boolean | undefined | null>,
      }),
    )
    return buildAipPage(data, 'tools', parseToolCatalogEntry, (token) => this.listPage(pageSize, token))
  }
}
