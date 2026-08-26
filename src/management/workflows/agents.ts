import type { ModusConfig } from '../../_config.js'
import type { OperationId } from '../../_generated/operations.js'
import type { HttpClient } from '../../_http.js'
import { updateMaskQuery } from '../../_query.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../../_request.js'
import { validateId, validatePageSize } from '../../_validation.js'
import type { Workflow, WorkflowType } from '../../types/workflows.js'
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
  type?: WorkflowType,
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

function parseWorkflow(raw: unknown): Workflow {
  return raw as Workflow
}

export interface CreateWorkflowOptions {
  name: string
  type: WorkflowType
  description?: string
  trigger?: TriggerInput
  agentSelection?: AgentSelectionInput
  workflowStructure?: WorkflowGraphInput
  guardrails?: string[]
}

/** @deprecated Use `CreateWorkflowOptions` instead. */
export type CreateAgentOptions = CreateWorkflowOptions

export interface UpdateWorkflowOptions {
  name?: string
  type?: WorkflowType
  description?: string
  trigger?: TriggerInput
  agentSelection?: AgentSelectionInput
  workflowStructure?: WorkflowGraphInput
  guardrails?: string[]
  updateMask?: string
}

/** @deprecated Use `UpdateWorkflowOptions` instead. */
export type UpdateAgentOptions = UpdateWorkflowOptions

export class ManagementWorkflowsResource {
  protected readonly ops: ManagementWorkflowsOperations = MANAGEMENT_WORKFLOW_OPERATIONS

  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  /**
   * List workflows in the organization.
   *
   * @param options.pageSize - Maximum items per page (default 25).
   * @param options.pageToken - Token from a previous page's `nextPageToken`; omit for the first page.
   * @param options.search - Case-insensitive substring filter on the workflow name.
   * @param options.type - Filter by workflow type: `"task"` or `"workflow"`.
   * @param options.view - Variation view: `"active"` (deployed) or `"draft"`.
   * @param options.includeVariation - Include variation payload on each list row.
   * @returns A page of workflows.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * for await (const wf of (await mgmt.workflows.list({ search: 'digest' })).autoPagingIter()) {
   *   console.log(wf.id, wf.name, wf.status)
   * }
   * ```
   */
  list(options: {
    pageSize?: number
    pageToken?: string
    search?: string
    type?: WorkflowType
    view?: VariationView
    includeVariation?: boolean
  } = {}): Promise<Page<Workflow>> {
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
    type?: WorkflowType,
    view?: VariationView,
    includeVariation?: boolean,
  ): Promise<Page<Workflow>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, this.ops.list, {
        query: workflowsListParams(pageSize, pageToken, search, type, view, includeVariation),
      }),
    )
    // List envelope is `workflows` only (Release N+1).
    return buildAipPage(
      data,
      'workflows',
      parseWorkflow,
      (token) => this.listPage(pageSize, token, search, type, view, includeVariation),
    )
  }

  /**
   * Retrieve a workflow with full configuration.
   *
   * @param workflowId - Workflow id.
   * @param options.view - Variation view: `"active"` (deployed) or `"draft"`.
   * @returns The workflow.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * const wf = await mgmt.workflows.get('weekly-digest')
   * console.log(wf.name, wf.status)
   * ```
   */
  async get(workflowId: number | string, options: { view?: VariationView } = {}): Promise<Workflow> {
    validateId(workflowId, 'workflow_id')
    const query = options.view !== undefined ? { view: options.view } : undefined
    const data = await invokeWithRetry(this.config, this.http, this.ops.get, {
      pathParams: { id: workflowId },
      query,
    })
    return parseWorkflow(data)
  }

  /**
   * Interfaces attached to a workflow.
   *
   * @param workflowId - Workflow id.
   * @returns An interfaces resource scoped to the workflow.
   */
  interfaces(workflowId: number | string): WorkflowInterfacesResource {
    return new WorkflowInterfacesResource(this.http, this.config, workflowId)
  }

  /**
   * Create a new workflow in the organization.
   *
   * @param options.name - Display name for the workflow.
   * @param options.type - `"task"` for single-step orchestration, or `"workflow"` for a multi-step graph.
   * @param options.trigger - Optional trigger configuration.
   * @param options.guardrails - Runtime guardrail labels (for example `"no-pii"`). Omit to create with no guardrails.
   * @returns The created workflow (draft).
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * const wf = await mgmt.workflows.create({ name: 'Daily report', type: 'task' })
   * ```
   */
  async create(options: CreateWorkflowOptions): Promise<Workflow> {
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

  /**
   * Update a workflow's configuration.
   *
   * Only the fields you pass are changed. To clear a field, name it in
   * `updateMask` and leave its argument unset.
   *
   * @param workflowId - Workflow id.
   * @param options.guardrails - Guardrail labels to set. Fetches the current workflow first to merge. Pass `[]` to clear all.
   * @param options.updateMask - Comma-separated field names to update or clear.
   * @returns The updated workflow.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * const wf = await mgmt.workflows.update('PLACEHOLDER_WORKFLOW_ID', { description: 'Runs every morning' })
   * ```
   */
  async update(workflowId: number | string, options: UpdateWorkflowOptions = {}): Promise<Workflow> {
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

  /**
   * Publish the current draft of a workflow.
   *
   * @param workflowId - Workflow id.
   * @returns The published workflow.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * await mgmt.workflows.update('PLACEHOLDER_WORKFLOW_ID', { description: 'Runs every morning' })
   * const published = await mgmt.workflows.deploy('PLACEHOLDER_WORKFLOW_ID')
   * ```
   */
  async deploy(workflowId: number | string): Promise<Workflow> {
    validateId(workflowId, 'workflow_id')
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, this.ops.deploy, {
        pathParams: { id: workflowId },
        jsonBody: {},
      }),
    )
    return parseWorkflow(data.workflow)
  }

  /**
   * Enable or disable a workflow without deleting it.
   *
   * @param workflowId - Workflow id.
   * @param options.active - `true` to activate, `false` to deactivate.
   * @returns The updated workflow.
   */
  async toggle(workflowId: number | string, options: { active: boolean }): Promise<Workflow> {
    validateId(workflowId, 'workflow_id')
    const data = await invokeWithRetry(this.config, this.http, this.ops.toggle, {
      pathParams: { id: workflowId },
      jsonBody: { active: options.active },
    })
    return parseWorkflow(data)
  }

  /**
   * Delete a workflow.
   *
   * @param workflowId - Workflow id.
   * @returns Resolves when the workflow is deleted.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * await mgmt.workflows.delete('PLACEHOLDER_WORKFLOW_ID')
   * ```
   */
  async delete(workflowId: number | string): Promise<void> {
    validateId(workflowId, 'workflow_id')
    await invokeWithRetry(this.config, this.http, this.ops.delete, {
      pathParams: { id: workflowId },
    })
  }

  /**
   * Restore a previously deleted workflow.
   *
   * @param workflowId - Workflow id.
   * @returns The restored workflow.
   */
  async restore(workflowId: number | string): Promise<Workflow> {
    validateId(workflowId, 'workflow_id')
    const data = await invokeWithRetry(this.config, this.http, this.ops.restore, {
      pathParams: { id: workflowId },
      jsonBody: {},
    })
    return parseWorkflow(data)
  }

  /**
   * Start transferring ownership of a workflow to another organization member.
   *
   * @param workflowId - Workflow id.
   * @param options.newOwnerUserId - User id of the proposed new owner.
   * @returns The workflow with a pending ownership transfer.
   */
  async requestOwnershipTransfer(
    workflowId: number | string,
    options: { newOwnerUserId: string },
  ): Promise<Workflow> {
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

  /** Cancel a pending workflow ownership transfer. */
  async cancelOwnershipTransfer(workflowId: number | string): Promise<Workflow> {
    validateId(workflowId, 'workflow_id')
    const data = await invokeWithRetry(
      this.config,
      this.http,
      this.ops.cancelOwnershipTransfer,
      { pathParams: { id: workflowId } },
    )
    return parseWorkflow(data)
  }

  /** Accept a pending workflow ownership transfer. */
  async acceptOwnershipTransfer(workflowId: number | string): Promise<Workflow> {
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
