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
  skillId?: number
  skillIds?: readonly number[]
}): Record<string, string | number | undefined> {
  return {
    pageSize: options.pageSize,
    pageToken: options.pageToken,
    skill_id: options.skillId,
    skill_ids: options.skillIds?.join(','),
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
    skillId?: number
    skillIds?: readonly number[]
  } = {}): Promise<Page<SuggestionQuestion>> {
    const pageSize = options.pageSize ?? DEFAULT_SUGGESTIONS_PAGE_SIZE
    validatePageSize(pageSize, MAX_SUGGESTIONS_PAGE_SIZE)
    return this.listPage(pageSize, options.pageToken, options.skillId, options.skillIds)
  }

  private async listPage(
    pageSize: number,
    pageToken: string | undefined,
    skillId: number | undefined,
    skillIds: readonly number[] | undefined,
  ): Promise<Page<SuggestionQuestion>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'SuggestionsController_listApproved', {
        query: suggestionListParams({ pageSize, pageToken, skillId, skillIds }),
      }),
    )
    return buildAipPage(data, 'suggestions', parseSuggestion, (token) =>
      this.listPage(pageSize, token, skillId, skillIds),
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
