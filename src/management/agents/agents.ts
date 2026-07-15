import type { ModusConfig } from '../../_config.js'
import type { OperationId } from '../../_generated/operations.js'
import type { HttpClient } from '../../_http.js'
import { updateMaskQuery } from '../../_query.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../../_request.js'
import { validateId, validatePageSize } from '../../_validation.js'
import type { Agent, AgentType } from '../../types/agents.js'
import type { VariationView } from '../../types/views.js'
import {
  accessConfigBodyForCreate,
  accessConfigBodyForUpdate,
} from '../_access-config.js'
import { WorkflowInterfacesResource } from './interfaces.js'

export type TriggerInput = Record<string, unknown>
export type AgentSelectionInput = Record<string, unknown>
export type WorkflowGraphInput = Record<string, unknown>

/** The canonical `/api/v1/workflows` management operationIds. */
interface ManagementWorkflowsOperations {
  readonly list: OperationId
  readonly get: OperationId
  readonly create: OperationId
  readonly update: OperationId
  readonly deploy: OperationId
  readonly delete: OperationId
  readonly restore: OperationId
  readonly requestOwnershipTransfer: OperationId
  readonly cancelOwnershipTransfer: OperationId
  readonly acceptOwnershipTransfer: OperationId
  readonly toggle: OperationId
}

const MANAGEMENT_WORKFLOW_OPERATIONS: ManagementWorkflowsOperations = {
  list: 'WorkflowsController_list',
  get: 'WorkflowsController_get',
  create: 'WorkflowsController_create',
  update: 'WorkflowsController_update',
  deploy: 'WorkflowsController_deploy',
  delete: 'WorkflowsController_delete',
  restore: 'WorkflowsController_restore',
  requestOwnershipTransfer: 'WorkflowsController_requestOwnershipTransfer',
  cancelOwnershipTransfer: 'WorkflowsController_cancelOwnershipTransfer',
  acceptOwnershipTransfer: 'WorkflowsController_acceptOwnershipTransfer',
  toggle: 'WorkflowsController_toggle',
}

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

export interface CreateAgentOptions {
  name: string
  type: AgentType
  description?: string
  trigger?: TriggerInput
  agentSelection?: AgentSelectionInput
  workflowStructure?: WorkflowGraphInput
  guardrails?: string[]
}

export interface UpdateAgentOptions {
  name?: string
  type?: AgentType
  description?: string
  trigger?: TriggerInput
  agentSelection?: AgentSelectionInput
  workflowStructure?: WorkflowGraphInput
  guardrails?: string[]
  updateMask?: string
}

export class ManagementWorkflowsResource {
  protected readonly ops: ManagementWorkflowsOperations = MANAGEMENT_WORKFLOW_OPERATIONS

  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

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
      await invokeWithRetry(this.config, this.http, this.ops.list, {
        query: workflowsListParams(pageSize, pageToken, search, type, view, includeVariation),
      }),
    )
    // Envelope key is the server DTO property name (`agents`) — unchanged by
    // the rename, which only moved paths/opIds/tags to the workflows vocab.
    return buildAipPage(data, 'agents', parseWorkflow, (token) =>
      this.listPage(pageSize, token, search, type, view, includeVariation),
    )
  }

  async get(workflowId: number | string, options: { view?: VariationView } = {}): Promise<Agent> {
    validateId(workflowId, 'workflow_id')
    const query = options.view !== undefined ? { view: options.view } : undefined
    const data = await invokeWithRetry(this.config, this.http, this.ops.get, {
      pathParams: { id: workflowId },
      query,
    })
    return parseWorkflow(data)
  }

  interfaces(workflowId: number | string): WorkflowInterfacesResource {
    return new WorkflowInterfacesResource(this.http, this.config, workflowId)
  }

  async create(options: CreateAgentOptions): Promise<Agent> {
    const body = omitUndefined({
      name: options.name,
      type: options.type,
      description: options.description,
      trigger: options.trigger,
      agentSelection: options.agentSelection,
      workflowStructure: options.workflowStructure,
      accessConfig: accessConfigBodyForCreate(options.guardrails),
    })
    const data = await invokeWithRetry(this.config, this.http, this.ops.create, {
      jsonBody: body,
    })
    return parseWorkflow(data)
  }

  async update(workflowId: number | string, options: UpdateAgentOptions = {}): Promise<Agent> {
    validateId(workflowId, 'workflow_id')
    const accessConfig = await accessConfigBodyForUpdate(options.guardrails, async () =>
      asRecord(
        await invokeWithRetry(this.config, this.http, this.ops.get, {
          pathParams: { id: workflowId },
        }),
      ),
    )
    const fields = {
      name: options.name,
      type: options.type,
      description: options.description,
      trigger: options.trigger,
      agentSelection: options.agentSelection,
      workflowStructure: options.workflowStructure,
      accessConfig,
    }
    const body = options.updateMask !== undefined ? fields : omitUndefined(fields)
    const data = await invokeWithRetry(this.config, this.http, this.ops.update, {
      pathParams: { id: workflowId },
      query: updateMaskQuery(options.updateMask),
      jsonBody: body,
    })
    return parseWorkflow(data)
  }

  async deploy(workflowId: number | string): Promise<Agent> {
    validateId(workflowId, 'workflow_id')
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, this.ops.deploy, {
        pathParams: { id: workflowId },
        jsonBody: {},
      }),
    )
    return parseWorkflow(data.agent)
  }

  async toggle(workflowId: number | string, options: { active: boolean }): Promise<Agent> {
    validateId(workflowId, 'workflow_id')
    const data = await invokeWithRetry(this.config, this.http, this.ops.toggle, {
      pathParams: { id: workflowId },
      jsonBody: { active: options.active },
    })
    return parseWorkflow(data)
  }

  async delete(workflowId: number | string): Promise<void> {
    validateId(workflowId, 'workflow_id')
    await invokeWithRetry(this.config, this.http, this.ops.delete, {
      pathParams: { id: workflowId },
    })
  }

  async restore(workflowId: number | string): Promise<Agent> {
    validateId(workflowId, 'workflow_id')
    const data = await invokeWithRetry(this.config, this.http, this.ops.restore, {
      pathParams: { id: workflowId },
      jsonBody: {},
    })
    return parseWorkflow(data)
  }

  async requestOwnershipTransfer(
    workflowId: number | string,
    options: { newOwnerUserId: string },
  ): Promise<Agent> {
    validateId(workflowId, 'workflow_id')
    const data = await invokeWithRetry(
      this.config,
      this.http,
      this.ops.requestOwnershipTransfer,
      {
        pathParams: { id: workflowId },
        jsonBody: omitUndefined({ newOwnerUserId: options.newOwnerUserId }),
      },
    )
    return parseWorkflow(data)
  }

  async cancelOwnershipTransfer(workflowId: number | string): Promise<Agent> {
    validateId(workflowId, 'workflow_id')
    const data = await invokeWithRetry(
      this.config,
      this.http,
      this.ops.cancelOwnershipTransfer,
      { pathParams: { id: workflowId } },
    )
    return parseWorkflow(data)
  }

  async acceptOwnershipTransfer(workflowId: number | string): Promise<Agent> {
    validateId(workflowId, 'workflow_id')
    const data = await invokeWithRetry(
      this.config,
      this.http,
      this.ops.acceptOwnershipTransfer,
      { pathParams: { id: workflowId }, jsonBody: {} },
    )
    return parseWorkflow(data)
  }
}
