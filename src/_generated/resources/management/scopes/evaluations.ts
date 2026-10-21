// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../../_config.js'
import type { HttpClient } from '../../../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../../../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../../../../_request.js'
import { validateId, validatePageSize } from '../../../../_validation.js'
import type {
  EvaluationConfig,
  EvaluationRun,
  EvaluationRunWithResults,
  TriggerEvaluationRunResponse,
  UpdateEvaluationConfig,
} from '../../../../management/types/evaluations.js'

/** Generated base for the management `scopes.evaluations` resource. */
export class ScopesEvaluationsResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
    protected readonly scopeId: number | string,
  ) {}

  /**
   * Get evaluation configuration.
   *
   * Returns the evaluation configuration for a scope, including judge settings, schedule cadence,
   * and notification preferences.
   *
   * **Requires:** `scopes:read`
   */
  async getConfig(): Promise<EvaluationConfig> {
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'EvaluationsController_getConfig', {
      pathParams: { id: this.scopeId },
    })
    return data as EvaluationConfig
  }

  /**
   * Update evaluation configuration.
   *
   * Updates the evaluation configuration for a scope. Changes to the schedule cadence are synced
   * automatically.
   *
   * **Requires:** `scopes:write`
   *
   * @param update - Request body; see `UpdateEvaluationConfig`.
   */
  async updateConfig(update: UpdateEvaluationConfig): Promise<EvaluationConfig> {
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'EvaluationsController_updateConfig', {
      pathParams: { id: this.scopeId },
      jsonBody: omitUndefined(update as Record<string, unknown>),
    })
    return data as EvaluationConfig
  }

  /**
   * Trigger evaluation run.
   *
   * Triggers a manual evaluation run for the scope. The run executes asynchronously.
   *
   * **Requires:** `scopes:write`
   *
   * @returns Evaluation run accepted and queued. The run executes asynchronously; poll `GET
   *   /scopes/{id}/evaluations/runs/{runId}` for status.
   */
  async triggerRun(): Promise<TriggerEvaluationRunResponse> {
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'EvaluationsController_triggerRun', {
      pathParams: { id: this.scopeId },
    })
    return data as TriggerEvaluationRunResponse
  }

  /**
   * List evaluation runs.
   *
   * Returns a paginated list of evaluation runs for the scope, ordered by most recent first.
   *
   * **Requires:** `scopes:read`
   *
   * @param options.pageSize - Items per page. Defaults to 25.
   * @returns A page of runs.
   */
  listRuns(options: {
    pageSize?: number
    pageToken?: string
  } = {}): Promise<Page<EvaluationRun>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listRunsPage(pageSize, options.pageToken)
  }

  protected async listRunsPage(
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
    return buildAipPage(
      data,
      'runs',
      (raw) => raw as EvaluationRun,
      (token) => this.listRunsPage(pageSize, token),
    )
  }

  /**
   * Get evaluation run.
   *
   * Returns details of an evaluation run including all per-case results.
   *
   * **Requires:** `scopes:read`
   *
   * @param runId - Run ID.
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
