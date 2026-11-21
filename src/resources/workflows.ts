import { WorkflowsResourceBase } from '../_generated/resources/consumption/workflows.js'
import type { ModusConfig } from '../_config.js'
import type { HttpClient } from '../_http.js'
import { startChat, type ChatSession, type WorkflowChatOptions } from '../_chat.js'
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
 * - `list` / `get` — browse workflows (`view: 'active'`, `'draft'`, or `'published'`)
 * - `chat` — send a workflow a message and stream its reply
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
   * Retrieve a workflow by its numeric id.
   *
   * @param workflowId - Numeric workflow id.
   * @param options.view - Which saved version to return (`active` or `draft`).
   * @param options.includeVariation - Include variation metadata when supported.
   * @returns The workflow (`id`, `name`, `status`, …).
   * @throws {NotFoundError} When no workflow has this id.
   *
   * @example
   * ```ts
   * const [first] = (await client.workflows.list()).items
   * const wf = await client.workflows.get(first.id)
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

  /**
   * Run a published workflow and stream its node output live from the agent
   * host: iterate `textStream()` for tokens, or `await` the result for the
   * workflow's final output. Call it with no message to trigger a run with no input.
   *
   * @param workflowId - Numeric workflow id.
   * @param message - The run's input; omit it for a run with no input.
   * @param options.threadId - Continue an existing conversation; omit to start new.
   * @param options.model - Deprecated and ignored: each step uses the model set in the workflow.
   * @returns A chat session — iterate it or `await` it for `content`, `threadId`, `runId`.
   * @throws {ModusError} When no agent host is known for a custom `baseUrl`.
   *
   * @example
   * ```ts
   * const { content } = await client.workflows.chat(workflowId)
   * const digest = await client.workflows.chat(workflowId, "Run this week's digest")
   * console.log(content, digest.content)
   * ```
   */
  chat(workflowId: number | string, message = '', options: WorkflowChatOptions = {}): ChatSession {
    return startChat(this.http, this.config, { kind: 'workflows', id: workflowId }, message, options)
  }
}
