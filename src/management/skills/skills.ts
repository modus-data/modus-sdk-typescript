import type { ModusConfig } from '../../_config.js'
import type { OperationId } from '../../_generated/operations.js'
import type { HttpClient } from '../../_http.js'
import { updateMaskQuery } from '../../_query.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../../_request.js'
import { validateId, validatePageSize } from '../../_validation.js'
import { ScopeConversationsResource } from '../../resources/skills/conversations.js'
import type { Skill } from '../../types/skills.js'
import type { VariationView } from '../../types/views.js'
import {
  accessConfigBodyForCreate,
  accessConfigBodyForUpdate,
} from '../_access-config.js'
import type { JsonObjectListInput } from '../types/json-blob.js'
import type { ToolsetInput } from '../types/toolset.js'
import { ScopeMemoriesResource } from './memories.js'
import { ScopeEvaluationsResource } from './evaluations.js'

/** The canonical `/api/v1/scopes` management operationIds. */
interface ManagementScopesOperations {
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
  readonly patchMcpConfig: OperationId
  readonly getVariation: OperationId
}

const MANAGEMENT_SCOPE_OPERATIONS: ManagementScopesOperations = {
  list: 'ScopesController_list',
  get: 'ScopesController_get',
  create: 'ScopesController_create',
  update: 'ScopesController_update',
  deploy: 'ScopesController_deploy',
  delete: 'ScopesController_delete',
  restore: 'ScopesController_restore',
  requestOwnershipTransfer: 'ScopesController_requestOwnershipTransfer',
  cancelOwnershipTransfer: 'ScopesController_cancelOwnershipTransfer',
  acceptOwnershipTransfer: 'ScopesController_acceptOwnershipTransfer',
  patchMcpConfig: 'ScopesController_patchMcpConfig',
  getVariation: 'ScopesController_getVariation',
}

function scopesListParams(
  pageSize: number,
  pageToken: string | undefined,
  search?: string,
  view?: VariationView,
  managerId?: number,
): Record<string, string | number | boolean | undefined | null> {
  const extra: Record<string, string | number | boolean | undefined | null> = {}
  if (search !== undefined) extra.search = search
  if (view !== undefined) extra.view = view
  if (managerId !== undefined) extra.managerId = managerId
  return aipListParams(pageSize, pageToken, extra) as Record<
    string,
    string | number | boolean | undefined | null
  >
}

function parseScope(raw: unknown): Skill {
  return raw as Skill
}

export interface CreateSkillOptions {
  name: string
  description?: string
  expectedOutput?: string
  instructions?: string[]
  toolset?: ToolsetInput
  model?: string
  connectionSet?: JsonObjectListInput
  contextSelections?: JsonObjectListInput
  interfaces?: JsonObjectListInput
  guardrails?: string[]
}

export interface UpdateSkillOptions {
  name?: string
  description?: string
  expectedOutput?: string
  instructions?: string[]
  toolset?: ToolsetInput
  model?: string
  connectionSet?: JsonObjectListInput
  contextSelections?: JsonObjectListInput
  interfaces?: JsonObjectListInput
  guardrails?: string[]
  managerId?: string
  evaluations?: JsonObjectListInput
  supervisionSubordinateDescriptions?: Record<string, string>
  updateMask?: string
}

/** Full CRUD and lifecycle for Modus scopes (`/api/v1/scopes`). */
export class ManagementScopesResource {
  protected readonly ops: ManagementScopesOperations = MANAGEMENT_SCOPE_OPERATIONS

  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  conversations(scopeId: number | string): ScopeConversationsResource {
    return new ScopeConversationsResource(this.http, this.config, scopeId)
  }

  memories(scopeId: number | string): ScopeMemoriesResource {
    return new ScopeMemoriesResource(this.http, this.config, scopeId)
  }

  evaluations(scopeId: number | string): ScopeEvaluationsResource {
    return new ScopeEvaluationsResource(this.http, this.config, scopeId)
  }

  list(options: {
    pageSize?: number
    pageToken?: string
    search?: string
    view?: VariationView
    managerId?: number
  } = {}): Promise<Page<Skill>> {
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize)
    return this.listPage(
      pageSize,
      options.pageToken,
      options.search,
      options.view,
      options.managerId,
    )
  }

  private async listPage(
    pageSize: number,
    pageToken: string | undefined,
    search?: string,
    view?: VariationView,
    managerId?: number,
  ): Promise<Page<Skill>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, this.ops.list, {
        query: scopesListParams(pageSize, pageToken, search, view, managerId),
      }),
    )
    // Envelope key is the server DTO property name (`skills`) — unchanged by
    // the rename, which only moved paths/opIds/tags to the scopes vocab.
    return buildAipPage(data, 'skills', parseScope, (token) =>
      this.listPage(pageSize, token, search, view, managerId),
    )
  }

  async get(scopeId: number | string, options: { view?: VariationView } = {}): Promise<Skill> {
    validateId(scopeId, 'scope_id')
    const query = options.view !== undefined ? { view: options.view } : undefined
    const data = await invokeWithRetry(this.config, this.http, this.ops.get, {
      pathParams: { id: scopeId },
      query,
    })
    return parseScope(data)
  }

  async create(options: CreateSkillOptions): Promise<Skill> {
    const body = omitUndefined({
      name: options.name,
      description: options.description,
      expectedOutput: options.expectedOutput,
      instructions: options.instructions,
      toolset: options.toolset,
      model: options.model,
      connectionSet: options.connectionSet,
      contextSelections: options.contextSelections,
      interfaces: options.interfaces,
      accessConfig: accessConfigBodyForCreate(options.guardrails),
    })
    const data = await invokeWithRetry(this.config, this.http, this.ops.create, {
      jsonBody: body,
    })
    return parseScope(data)
  }

  async update(scopeId: number | string, options: UpdateSkillOptions = {}): Promise<Skill> {
    validateId(scopeId, 'scope_id')
    const accessConfig = await accessConfigBodyForUpdate(options.guardrails, async () =>
      asRecord(
        await invokeWithRetry(this.config, this.http, this.ops.get, {
          pathParams: { id: scopeId },
        }),
      ),
    )
    const fields = {
      name: options.name,
      description: options.description,
      expectedOutput: options.expectedOutput,
      instructions: options.instructions,
      toolset: options.toolset,
      model: options.model,
      connectionSet: options.connectionSet,
      contextSelections: options.contextSelections,
      interfaces: options.interfaces,
      accessConfig,
      managerId: options.managerId,
      evaluations: options.evaluations,
      supervisionSubordinateDescriptions: options.supervisionSubordinateDescriptions,
    }
    const body =
      options.updateMask !== undefined ? fields : omitUndefined(fields)
    const data = await invokeWithRetry(this.config, this.http, this.ops.update, {
      pathParams: { id: scopeId },
      query: updateMaskQuery(options.updateMask),
      jsonBody: body,
    })
    return parseScope(data)
  }

  async deploy(scopeId: number | string): Promise<Skill> {
    validateId(scopeId, 'scope_id')
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, this.ops.deploy, {
        pathParams: { id: scopeId },
        jsonBody: {},
      }),
    )
    return parseScope(data.skill)
  }

  async delete(scopeId: number | string): Promise<void> {
    validateId(scopeId, 'scope_id')
    await invokeWithRetry(this.config, this.http, this.ops.delete, {
      pathParams: { id: scopeId },
    })
  }

  async restore(scopeId: number | string): Promise<Skill> {
    validateId(scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, this.ops.restore, {
      pathParams: { id: scopeId },
      jsonBody: {},
    })
    return parseScope(data)
  }

  async requestOwnershipTransfer(
    scopeId: number | string,
    options: { newOwnerUserId: string },
  ): Promise<Skill> {
    validateId(scopeId, 'scope_id')
    const data = await invokeWithRetry(
      this.config,
      this.http,
      this.ops.requestOwnershipTransfer,
      {
        pathParams: { id: scopeId },
        jsonBody: omitUndefined({ newOwnerUserId: options.newOwnerUserId }),
      },
    )
    return parseScope(data)
  }

  async cancelOwnershipTransfer(scopeId: number | string): Promise<Skill> {
    validateId(scopeId, 'scope_id')
    const data = await invokeWithRetry(
      this.config,
      this.http,
      this.ops.cancelOwnershipTransfer,
      { pathParams: { id: scopeId } },
    )
    return parseScope(data)
  }

  async acceptOwnershipTransfer(scopeId: number | string): Promise<Skill> {
    validateId(scopeId, 'scope_id')
    const data = await invokeWithRetry(
      this.config,
      this.http,
      this.ops.acceptOwnershipTransfer,
      { pathParams: { id: scopeId }, jsonBody: {} },
    )
    return parseScope(data)
  }

  async patchMcpConfig(
    scopeId: number | string,
    options: { mcpConfig: Record<string, unknown> },
  ): Promise<void> {
    validateId(scopeId, 'scope_id')
    await invokeWithRetry(this.config, this.http, this.ops.patchMcpConfig, {
      pathParams: { id: scopeId },
      jsonBody: omitUndefined({ config: options.mcpConfig }),
    })
  }

  async getVariation(
    scopeId: number | string,
    options: { variationUid: string },
  ): Promise<Skill> {
    validateId(scopeId, 'scope_id')
    validateId(options.variationUid, 'variation_uid')
    const data = await invokeWithRetry(this.config, this.http, this.ops.getVariation, {
      pathParams: { id: scopeId, variationUid: options.variationUid },
    })
    return parseScope(data)
  }
}
