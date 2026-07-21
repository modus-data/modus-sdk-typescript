import type { ModusConfig } from '../_config.js'
import type { HttpClient } from '../_http.js'
import { buildAipPage, type Page } from '../_pagination.js'
import { asRecord, invokeWithRetry } from '../_request.js'
import { validateId, validatePageSize } from '../_validation.js'
import {
  normalizeRecordSuggestionEvent,
  type RecordSuggestionEventRequest,
  type SuggestionQuestion,
} from '../types/suggestions.js'

const DEFAULT_SUGGESTIONS_PAGE_SIZE = 5
const MAX_SUGGESTIONS_PAGE_SIZE = 12

function parseSuggestion(raw: unknown): SuggestionQuestion {
  return raw as SuggestionQuestion
}

function suggestionListParams(options: {
  pageSize: number
  pageToken?: string
  scopeId?: number
  scopeIds?: readonly number[]
}): Record<string, string | number | undefined> {
  return {
    pageSize: options.pageSize,
    pageToken: options.pageToken,
    scope_id: options.scopeId,
    scope_ids: options.scopeIds?.join(','),
  }
}

export class SuggestionsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  list(options: {
    pageSize?: number
    pageToken?: string
    scopeId?: number
    scopeIds?: readonly number[]
  } = {}): Promise<Page<SuggestionQuestion>> {
    const pageSize = options.pageSize ?? DEFAULT_SUGGESTIONS_PAGE_SIZE
    validatePageSize(pageSize, MAX_SUGGESTIONS_PAGE_SIZE)
    return this.listPage(pageSize, options.pageToken, options.scopeId, options.scopeIds)
  }

  private async listPage(
    pageSize: number,
    pageToken: string | undefined,
    scopeId: number | undefined,
    scopeIds: readonly number[] | undefined,
  ): Promise<Page<SuggestionQuestion>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'SuggestionsController_listApproved', {
        query: suggestionListParams({ pageSize, pageToken, scopeId, scopeIds }),
      }),
    )
    return buildAipPage(data, 'suggestions', parseSuggestion, (token) =>
      this.listPage(pageSize, token, scopeId, scopeIds),
    )
  }

  async recordEvent(id: string, event: RecordSuggestionEventRequest): Promise<void> {
    validateId(id, 'id')
    await invokeWithRetry(this.config, this.http, 'SuggestionsController_recordEvent', {
      pathParams: { id },
      jsonBody: normalizeRecordSuggestionEvent(event),
    })
  }
}
