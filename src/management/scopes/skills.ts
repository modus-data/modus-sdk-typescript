import type { ModusConfig } from '../../_config.js'
import type { OperationId } from '../../_generated/operations.js'
import type { HttpClient } from '../../_http.js'
import { updateMaskQuery } from '../../_query.js'
import { aipListParams, buildAipPage, type Page } from '../../_pagination.js'
import { asRecord, invokeWithRetry, omitUndefined } from '../../_request.js'
import { validateId, validatePageSize } from '../../_validation.js'
import { ScopeConversationsResource } from '../../resources/scopes/conversations.js'
import type { Scope } from '../../types/scopes.js'
import type { VariationView } from '../../types/views.js'
import {
  accessConfigBodyForCreate,
  accessConfigBodyForUpdate,
} from '../_access-config.js'
import type { JsonObjectListInput } from '../types/json-blob.js'
import type { ToolsetInput } from '../types/toolset.js'
import { ScopeMemoriesResource } from './memories.js'
import { ScopeEvaluationsResource } from './evaluations.js'
import { ScopeSupervisionResource } from './supervision.js'

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

function parseScope(raw: unknown): Scope {
  return raw as Scope
}

export interface CreateScopeOptions {
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

/** @deprecated Use `CreateScopeOptions` instead. */
export type CreateSkillOptions = CreateScopeOptions

export interface UpdateScopeOptions {
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

/** @deprecated Use `UpdateScopeOptions` instead. */
export type UpdateSkillOptions = UpdateScopeOptions

/**
 * Full CRUD and lifecycle for Modus scopes.
 *
 * Call path: `mgmt.scopes` after `new ModusManagement(...)`.
 */
export class ManagementScopesResource {
  protected readonly ops: ManagementScopesOperations = MANAGEMENT_SCOPE_OPERATIONS

  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  /**
   * Conversations for a scope.
   *
   * @param scopeId - Scope id.
   * @returns A conversations resource scoped to the scope.
   */
  conversations(scopeId: number | string): ScopeConversationsResource {
    return new ScopeConversationsResource(this.http, this.config, scopeId)
  }

  /**
   * Long-term memories for a scope.
   *
   * @param scopeId - Scope id.
   * @returns A memories resource scoped to the scope.
   */
  memories(scopeId: number | string): ScopeMemoriesResource {
    return new ScopeMemoriesResource(this.http, this.config, scopeId)
  }

  /**
   * Evaluations for a scope.
   *
   * @param scopeId - Scope id.
   * @returns An evaluations resource scoped to the scope.
   */
  evaluations(scopeId: number | string): ScopeEvaluationsResource {
    return new ScopeEvaluationsResource(this.http, this.config, scopeId)
  }

  /**
   * Supervision (subordinate scopes) for a scope.
   *
   * @param scopeId - Scope id.
   * @returns A supervision resource scoped to the scope.
   */
  supervision(scopeId: number | string): ScopeSupervisionResource {
    return new ScopeSupervisionResource(this.http, this.config, scopeId)
  }

  /**
   * List scopes in the organization.
   *
   * @param options.pageSize - Maximum items per page (default 25).
   * @param options.pageToken - Token from a previous page's `nextPageToken`; omit for the first page.
   * @param options.search - Case-insensitive substring filter on the scope name.
   * @param options.view - Variation view: `"active"` (deployed) or `"draft"`.
   * @param options.managerId - Return only scopes supervised by this manager scope id.
   * @returns A page of scopes — use `.autoPagingIter()` for all pages.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * for await (const scope of (await mgmt.scopes.list()).autoPagingIter()) {
   *   console.log(scope.id, scope.name, scope.status)
   * }
   * ```
   */
  list(options: {
    pageSize?: number
    pageToken?: string
    search?: string
    view?: VariationView
    managerId?: number
  } = {}): Promise<Page<Scope>> {
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
  ): Promise<Page<Scope>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, this.ops.list, {
        query: scopesListParams(pageSize, pageToken, search, view, managerId),
      }),
    )
    // List envelope is `scopes` only (Release N+1).
    return buildAipPage(
      data,
      'scopes',
      parseScope,
      (token) => this.listPage(pageSize, token, search, view, managerId),
    )
  }

  /**
   * Retrieve a scope with full configuration.
   *
   * @param scopeId - Scope id.
   * @param options.view - Variation view: `"active"` (deployed) or `"draft"`.
   * @returns The scope.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * const scope = await mgmt.scopes.get('PLACEHOLDER_SCOPE_ID')
   * console.log(scope.name, scope.status)
   * ```
   */
  async get(scopeId: number | string, options: { view?: VariationView } = {}): Promise<Scope> {
    validateId(scopeId, 'scope_id')
    const query = options.view !== undefined ? { view: options.view } : undefined
    const data = await invokeWithRetry(this.config, this.http, this.ops.get, {
      pathParams: { id: scopeId },
      query,
    })
    return parseScope(data)
  }

  /**
   * Create a new scope in the organization.
   *
   * @param options.name - Display name for the scope.
   * @param options.description - Optional description.
   * @param options.instructions - Optional system instructions.
   * @param options.model - Optional model id.
   * @param options.toolset - Optional tool selection for the scope.
   * @param options.guardrails - Runtime guardrail labels (for example `"no-pii"`). Omit to create with no guardrails.
   * @returns The created scope (draft).
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * const scope = await mgmt.scopes.create({ name: 'Support assistant', model: 'claude-sonnet-5' })
   * console.log(scope.id, scope.name)
   * ```
   */
  async create(options: CreateScopeOptions): Promise<Scope> {
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

  /**
   * Update a scope's configuration.
   *
   * Only the fields you pass are changed. To clear a field, name it in
   * `updateMask` (comma-separated field names) and leave its argument unset.
   *
   * @param scopeId - Scope id.
   * @param options.guardrails - Guardrail labels to set. Fetches the current scope first to merge. Pass `[]` to clear all.
   * @param options.updateMask - Comma-separated field names to update or clear.
   * @returns The updated scope.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * const scope = await mgmt.scopes.update('PLACEHOLDER_SCOPE_ID', {
   *   description: 'Answers billing questions for enterprise customers.',
   * })
   * ```
   */
  async update(scopeId: number | string, options: UpdateScopeOptions = {}): Promise<Scope> {
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

  /**
   * Publish the current draft of a scope.
   *
   * @param scopeId - Scope id.
   * @returns The published scope.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * const scope = await mgmt.scopes.create({ name: 'Support assistant' })
   * const published = await mgmt.scopes.deploy(scope.id)
   * console.log(published.status)
   * ```
   */
  async deploy(scopeId: number | string): Promise<Scope> {
    validateId(scopeId, 'scope_id')
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, this.ops.deploy, {
        pathParams: { id: scopeId },
        jsonBody: {},
      }),
    )
    return parseScope(data.scope)
  }

  /**
   * Delete a scope.
   *
   * @param scopeId - Scope id.
   * @returns Resolves when the scope is deleted.
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * await mgmt.scopes.delete('PLACEHOLDER_SCOPE_ID')
   * ```
   */
  async delete(scopeId: number | string): Promise<void> {
    validateId(scopeId, 'scope_id')
    await invokeWithRetry(this.config, this.http, this.ops.delete, {
      pathParams: { id: scopeId },
    })
  }

  /**
   * Restore a previously deleted scope.
   *
   * @param scopeId - Scope id.
   * @returns The restored scope.
   */
  async restore(scopeId: number | string): Promise<Scope> {
    validateId(scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, this.ops.restore, {
      pathParams: { id: scopeId },
      jsonBody: {},
    })
    return parseScope(data)
  }

  /**
   * Start transferring ownership of a scope to another organization member.
   *
   * @param scopeId - Scope id.
   * @param options.newOwnerUserId - User id of the proposed new owner.
   * @returns The scope with a pending ownership transfer.
   */
  async requestOwnershipTransfer(
    scopeId: number | string,
    options: { newOwnerUserId: string },
  ): Promise<Scope> {
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

  /** Cancel a pending scope ownership transfer. */
  async cancelOwnershipTransfer(scopeId: number | string): Promise<Scope> {
    validateId(scopeId, 'scope_id')
    const data = await invokeWithRetry(
      this.config,
      this.http,
      this.ops.cancelOwnershipTransfer,
      { pathParams: { id: scopeId } },
    )
    return parseScope(data)
  }

  /** Accept a pending scope ownership transfer. */
  async acceptOwnershipTransfer(scopeId: number | string): Promise<Scope> {
    validateId(scopeId, 'scope_id')
    const data = await invokeWithRetry(
      this.config,
      this.http,
      this.ops.acceptOwnershipTransfer,
      { pathParams: { id: scopeId }, jsonBody: {} },
    )
    return parseScope(data)
  }

  /**
   * Update MCP server configuration for a scope.
   *
   * @param scopeId - Scope id.
   * @param options.mcpConfig - MCP configuration object.
   */
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

  /**
   * Retrieve a specific scope variation by uid.
   *
   * @param scopeId - Scope id.
   * @param options.variationUid - Variation uid.
   * @returns The scope variation.
   */
  async getVariation(
    scopeId: number | string,
    options: { variationUid: string },
  ): Promise<Scope> {
    validateId(scopeId, 'scope_id')
    validateId(options.variationUid, 'variation_uid')
    const data = await invokeWithRetry(this.config, this.http, this.ops.getVariation, {
      pathParams: { id: scopeId, variationUid: options.variationUid },
    })
    return parseScope(data)
  }
}
