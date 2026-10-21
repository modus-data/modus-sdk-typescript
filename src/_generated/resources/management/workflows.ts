// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../_config.js'
import type { HttpClient } from '../../../_http.js'
import { aipListParams, buildAipPage, type Page } from '../../../_pagination.js'
import { asRecord, invokeWithRetry } from '../../../_request.js'
import { validateId, validatePageSize } from '../../../_validation.js'
import type { VariationView } from '../../../types/views.js'
import type { Workflow, WorkflowType } from '../../../types/workflows.js'

/** Generated base for the management `workflows` resource. */
export class WorkflowsResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
  ) {}

  /**
   * List workflows.
   *
   * Returns a paginated page of workflows the caller can at least `use`. Workflows the caller
   * cannot see are filtered out. Pagination uses an opaque token returned in `nextPageToken`.
   *
   * **Requires:** `workflows:read`
   *
   * @param options.pageSize - Items per page. Defaults to 25.
   * @param options.pageToken - Opaque page token from a previous response's `nextPageToken`. Omit
   *   for the first page.
   * @param options.search - Case-insensitive substring filter on workflow name.
   * @param options.type - Filter by workflow type.
   * @param options.view - Variation view. `active` reads deployed; `draft` reads the latest builder
   *   snapshot.
   * @param options.includeVariation - Include the requested variation payload (`trigger`,
   *   `workflowStructure`, `agentSelection`) on list rows.
   * @returns A page of workflows.
   *
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
    return this.listPage(pageSize, options.pageToken, options.search, options.type, options.view, options.includeVariation)
  }

  protected async listPage(
    pageSize: number,
    pageToken: string | undefined,
    search?: string,
    type?: WorkflowType,
    view?: VariationView,
    includeVariation?: boolean,
  ): Promise<Page<Workflow>> {
    const extra: Record<string, string | boolean> = {}
    if (search !== undefined) extra.search = search
    if (type !== undefined) extra.type = type
    if (view !== undefined) extra.view = view
    if (includeVariation !== undefined) extra.includeVariation = includeVariation
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'WorkflowsController_list', {
        query: aipListParams(pageSize, pageToken, extra) as Record<
          string,
          string | number | boolean | undefined | null
        >,
      }),
    )
    return buildAipPage(
      data,
      'workflows',
      (raw) => raw as Workflow,
      (token) => this.listPage(pageSize, token, search, type, view, includeVariation),
    )
  }

  /**
   * Delete a workflow.
   *
   * Deletes a workflow and stops its schedule. The workflow can be restored later with POST
   * /workflows/{id}/restore. Deleting an already-deleted workflow is a no-op.
   *
   * **Requires:** `workflows:write`
   *
   * @param workflowId - Numeric workflow id.
   *
   * @example
   * ```ts
   * const mgmt = new ModusManagement()
   * await mgmt.workflows.delete('PLACEHOLDER_WORKFLOW_ID')
   * ```
   */
  async delete(workflowId: number | string): Promise<void> {
    validateId(workflowId, 'workflow_id')
    await invokeWithRetry(this.config, this.http, 'WorkflowsController_delete', {
      pathParams: { id: workflowId },
    })
  }

  /**
   * Restore a deleted workflow.
   *
   * Restores a previously deleted workflow and returns it. The workflow’s schedule is not resumed
   * automatically — re-enable it if it should run again. Restoring an active workflow returns it
   * unchanged.
   *
   * **Requires:** `workflows:write`
   *
   * @param workflowId - Numeric workflow id.
   */
  async restore(workflowId: number | string): Promise<Workflow> {
    validateId(workflowId, 'workflow_id')
    const data = await invokeWithRetry(this.config, this.http, 'WorkflowsController_restore', {
      pathParams: { id: workflowId },
      jsonBody: {},
    })
    return data as Workflow
  }

  /**
   * Cancel ownership transfer.
   *
   * Cancels a pending ownership transfer. The current owner may cancel; the pending recipient may
   * decline.
   *
   * **Requires:** `workflows:write`
   *
   * @param workflowId - Numeric workflow id.
   */
  async cancelOwnershipTransfer(workflowId: number | string): Promise<Workflow> {
    validateId(workflowId, 'workflow_id')
    const data = await invokeWithRetry(this.config, this.http, 'WorkflowsController_cancelOwnershipTransfer', {
      pathParams: { id: workflowId },
    })
    return data as Workflow
  }

  /**
   * Accept ownership transfer.
   *
   * Accepts a pending ownership transfer. Only the pending recipient may invoke this action.
   *
   * **Requires:** `workflows:write`
   *
   * @param workflowId - Numeric workflow id.
   */
  async acceptOwnershipTransfer(workflowId: number | string): Promise<Workflow> {
    validateId(workflowId, 'workflow_id')
    const data = await invokeWithRetry(this.config, this.http, 'WorkflowsController_acceptOwnershipTransfer', {
      pathParams: { id: workflowId },
      jsonBody: {},
    })
    return data as Workflow
  }
}
