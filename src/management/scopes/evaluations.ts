import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../../_request.js'
import { validateId, validatePageSize } from '../../_validation.js'
import type {
  EvaluationConfig,
  EvaluationRun,
  EvaluationRunWithResults,
  TriggerEvaluationRunResponse,
  UpdateEvaluationConfig,
} from '../types/evaluations.js'

function parseConfig(raw: unknown): EvaluationConfig {
  return raw as EvaluationConfig
}

function parseRun(raw: unknown): EvaluationRun {
  return raw as EvaluationRun
}

/** Scheduled and manual scope evaluations. */
export class ScopeEvaluationsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
    private readonly scopeId: number | string,
  ) {}

  /** Get the evaluation configuration for this scope. */
  async getConfig(): Promise<EvaluationConfig> {
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'EvaluationsController_getConfig', {
      pathParams: { id: this.scopeId },
    })
    return parseConfig(data)
  }

  /**
   * Update the evaluation configuration for this scope.
   *
   * @param update - Configuration fields to change.
   * @returns The updated evaluation configuration.
   */
  async updateConfig(update: UpdateEvaluationConfig): Promise<EvaluationConfig> {
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'EvaluationsController_updateConfig', {
      pathParams: { id: this.scopeId },
      jsonBody: omitUndefined(update as Record<string, unknown>),
    })
    return parseConfig(data)
  }

  /**
   * Trigger a manual evaluation run for this scope.
   *
   * @returns The triggered run id and status.
   */
  async triggerRun(): Promise<TriggerEvaluationRunResponse> {
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'EvaluationsController_triggerRun', {
      pathParams: { id: this.scopeId },
    })
    return data as TriggerEvaluationRunResponse
  }

  /**
   * List evaluation runs for this scope.
   *
   * @param options.pageSize - Items per page (default 25).
   * @param options.pageToken - Token from a previous page's `nextPageToken`.
   * @returns A page of evaluation runs.
   */
  listRuns(options: { pageSize?: number; pageToken?: string } = {}): Promise<Page<EvaluationRun>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listRunsPage(pageSize, options.pageToken)
  }

  private async listRunsPage(
    pageSize: number,
    pageToken: string | undefined,
  ): Promise<Page<EvaluationRun>> {
    validateId(this.scopeId, 'scope_id')
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'EvaluationsController_listRuns', {
        pathParams: { id: this.scopeId },
        query: aipListParams(pageSize, pageToken) as Record<
          string,
          string | number | boolean | undefined | null
        >,
      }),
    )
    return buildAipPage(data, 'runs', parseRun, (token) => this.listRunsPage(pageSize, token))
  }

  /**
   * Retrieve one evaluation run with full results.
   *
   * @param runId - Evaluation run id.
   * @returns The run and its result details.
   */
  async getRun(runId: string): Promise<EvaluationRunWithResults> {
    validateId(this.scopeId, 'scope_id')
    validateId(runId, 'run_id')
    const data = await invokeWithRetry(this.config, this.http, 'EvaluationsController_getRun', {
      pathParams: { id: this.scopeId, runId },
    })
    return data as EvaluationRunWithResults
  }
}
