// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../../_config.js'
import type { HttpClient } from '../../../../_http.js'
import { invokeWithRetry } from '../../../../_request.js'
import { validateId } from '../../../../_validation.js'
import type { AgentInterface } from '../../../../management/workflows/interfaces.js'

/** Generated base for the management `workflows.interfaces` resource. */
export class WorkflowsInterfacesResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
    protected readonly workflowId: number | string,
  ) {}

  /**
   * List interfaces attached to a workflow.
   *
   * Returns every Slack, MCP, or Teams interface bound to the workflow. Requires manage permission
   * on the workflow.
   *
   * **Requires:** `workflows:read`
   */
  async list(): Promise<AgentInterface[]> {
    validateId(this.workflowId, 'workflow_id')
    const data = await invokeWithRetry(this.config, this.http, 'WorkflowInterfacesController_list', {
      pathParams: { id: this.workflowId },
    })
    return (data as { interfaces: AgentInterface[] }).interfaces
  }

  /**
   * Remove every interface from a workflow.
   *
   * Deletes all interface rows attached to the workflow. Useful when recreating the interface set
   * from scratch.
   *
   * **Requires:** `workflows:write`
   */
  async deleteAll(): Promise<void> {
    validateId(this.workflowId, 'workflow_id')
    await invokeWithRetry(this.config, this.http, 'WorkflowInterfacesController_deleteAll', {
      pathParams: { id: this.workflowId },
    })
  }

  /**
   * Remove a workflow interface.
   *
   * Deletes one interface row. For MCP interfaces, bound MCP tokens are revoked best-effort.
   *
   * **Requires:** `workflows:write`
   *
   * @param interfaceId - Interface row id (UUID).
   */
  async delete(interfaceId: string): Promise<void> {
    validateId(this.workflowId, 'workflow_id')
    validateId(interfaceId, 'interface_id')
    await invokeWithRetry(this.config, this.http, 'WorkflowInterfacesController_delete', {
      pathParams: { id: this.workflowId, interfaceId },
    })
  }
}
