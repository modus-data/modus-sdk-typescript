import { WorkflowsResourceBase } from '../_generated/resources/consumption/workflows.js'
import type { ModusConfig } from '../_config.js'
import type { HttpClient } from '../_http.js'
import { invokeWithRetry } from '../_request.js'
import { validateId } from '../_validation.js'
import type { Workflow } from '../types/workflows.js'
import type { VariationView } from '../types/views.js'
import { WorkflowRunsResource } from './workflows/runs.js'
import { AgentWorkflowActionsResource } from './workflows/workflow-actions.js'

function parseWorkflow(raw: unknown): Workflow {
  return raw as Workflow
}

/**
 * Read and run access to Modus workflows.
 *
 * - `list` / `get` — browse workflows (`view: 'active'` or `'draft'`)
 * - {@link WorkflowRunsResource runs} — start, monitor, and control workflow runs
 * - {@link AgentWorkflowActionsResource workflowActions} — execute workflow actions
 *
 * @example
 * ```ts
 * import { Modus } from '@getmodus/sdk'
 * const client = new Modus()
 * for await (const wf of (await client.workflows.list()).autoPagingIter()) {
 *   console.log(wf.id, wf.name, wf.status)
 * }
 * ```
 */
export class WorkflowsResource extends WorkflowsResourceBase {
  readonly runs: WorkflowRunsResource
  readonly workflowActions: AgentWorkflowActionsResource

  /** @internal */
  constructor(
    http: HttpClient,
    config: ModusConfig,
  ) {
    super(http, config)
    this.runs = new WorkflowRunsResource(http, config)
    this.workflowActions = new AgentWorkflowActionsResource(http, config)
  }

  /**
   * Retrieve a workflow by ID or slug.
   *
   * @param workflowId - Numeric id or slug.
   * @param options.view - Which saved version to return (`active` or `draft`).
   * @param options.includeVariation - Include variation metadata when supported.
   * @returns The workflow (`id`, `name`, `status`, …).
   * @throws {NotFoundError} When no workflow matches the id or slug.
   *
   * @example
   * ```ts
   * const wf = await client.workflows.get('weekly-digest')
   * console.log(wf.name, wf.status)
   * ```
   */
  async get(
    workflowId: number | string,
    options: { view?: VariationView; includeVariation?: boolean } = {},
  ): Promise<Workflow> {
    validateId(workflowId, 'workflow_id')
    const query: Record<string, string | boolean> = {}
    if (options.view !== undefined) query.view = options.view
    if (options.includeVariation !== undefined) {
      query.includeVariation = options.includeVariation
    }
    const data = await invokeWithRetry(this.config, this.http, 'WorkflowsController_get', {
      pathParams: { id: workflowId },
      query: Object.keys(query).length > 0 ? query : undefined,
    })
    return parseWorkflow(data)
  }
}
