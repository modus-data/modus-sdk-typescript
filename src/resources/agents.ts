import { chatBuffered, chatStreamSession, type ChatStream } from '../_chat.js'
import type { ModusConfig } from '../_config.js'
import type { HttpClient } from '../_http.js'
import { aipListParams, buildAipPage, type Page } from '../_pagination.js'
import { asRecord, invokeWithRetry } from '../_request.js'
import { validateId, validatePageSize } from '../_validation.js'
import type { Agent, AgentType } from '../types/agents.js'
import type { ChatModel, ChatResult } from '../types/chat.js'
import type { VariationView } from '../types/views.js'
import { WorkflowRunsResource } from './agents/runs.js'
import { AgentWorkflowActionsResource } from './agents/workflow-actions.js'

function workflowsListParams(
  pageSize: number,
  pageToken: string | undefined,
  search?: string,
  type?: AgentType,
  view?: VariationView,
  includeVariation?: boolean,
): Record<string, string | number | boolean | undefined | null> {
  const extra: Record<string, string | number | boolean | undefined | null> = {}
  if (search !== undefined) extra.search = search
  if (type !== undefined) extra.type = type
  if (view !== undefined) extra.view = view
  if (includeVariation !== undefined) extra.includeVariation = includeVariation
  return aipListParams(pageSize, pageToken, extra) as Record<
    string,
    string | number | boolean | undefined | null
  >
}

function parseWorkflow(raw: unknown): Agent {
  return raw as Agent
}

/** Read / invoke access to Modus workflows (`/api/v1/workflows`). */
export class WorkflowsResource {
  readonly runs: WorkflowRunsResource
  readonly workflowActions: AgentWorkflowActionsResource

  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {
    this.runs = new WorkflowRunsResource(http, config)
    this.workflowActions = new AgentWorkflowActionsResource(http, config)
  }

  list(options: {
    pageSize?: number
    pageToken?: string
    search?: string
    type?: AgentType
    view?: VariationView
    includeVariation?: boolean
  } = {}): Promise<Page<Agent>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(
      pageSize,
      options.pageToken,
      options.search,
      options.type,
      options.view,
      options.includeVariation,
    )
  }

  private async listPage(
    pageSize: number,
    pageToken: string | undefined,
    search?: string,
    type?: AgentType,
    view?: VariationView,
    includeVariation?: boolean,
  ): Promise<Page<Agent>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'WorkflowsController_list', {
        query: workflowsListParams(
          pageSize,
          pageToken,
          search,
          type,
          view,
          includeVariation,
        ),
      }),
    )
    // Envelope key is the server DTO property name — unchanged by the rename
    // (only paths/opIds/tags moved to the workflows vocab).
    return buildAipPage(data, 'agents', parseWorkflow, (token) =>
      this.listPage(pageSize, token, search, type, view, includeVariation),
    )
  }

  async get(
    workflowId: number | string,
    options: { view?: VariationView; includeVariation?: boolean } = {},
  ): Promise<Agent> {
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

  chat(
    workflowId: number | string,
    message: string,
    options: { model: ChatModel; threadId?: string },
  ): Promise<ChatResult> {
    return chatBuffered(this.http, 'workflows', workflowId, message, options)
  }

  chatStream(
    workflowId: number | string,
    message: string,
    options: { model: ChatModel; threadId?: string; version?: string },
  ): ChatStream {
    return chatStreamSession(this.http, this.config, 'workflows', workflowId, message, options)
  }
}
