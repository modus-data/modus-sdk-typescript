import { WorkflowsInterfacesResourceBase } from '../../_generated/resources/management/workflows/interfaces.js'
import { updateMaskQuery } from '../../_query.js'
import { invokeWithRetry, omitUndefined } from '../../_request.js'
import { validateId } from '../../_validation.js'
import type { components } from '../../_generated/v1.js'

export type AgentInterface = components['schemas']['AgentInterfaceDto']
export type AddAgentInterface = components['schemas']['AddAgentInterfaceDto']
export type UpdateAgentInterface = components['schemas']['UpdateAgentInterfaceDto']

export class WorkflowInterfacesResource extends WorkflowsInterfacesResourceBase {

  /**
   * Add an interface to this workflow.
   *
   * @param options - Interface configuration to attach.
   * @returns The created interface.
   */
  async create(options: AddAgentInterface): Promise<AgentInterface> {
    validateId(this.workflowId, 'workflow_id')
    return await invokeWithRetry(this.config, this.http, 'WorkflowInterfacesController_add', {
      pathParams: { id: this.workflowId },
      jsonBody: omitUndefined(options),
    }) as AgentInterface
  }

  /**
   * Update an interface attached to this workflow.
   *
   * @param interfaceId - Interface id.
   * @param options - Updated interface values.
   * @param updateMask - Optional comma-separated field names to update.
   * @returns The updated interface.
   */
  async update(interfaceId: string, options: UpdateAgentInterface, updateMask?: string): Promise<AgentInterface> {
    validateId(this.workflowId, 'workflow_id')
    validateId(interfaceId, 'interface_id')
    return await invokeWithRetry(this.config, this.http, 'WorkflowInterfacesController_update', {
      pathParams: { id: this.workflowId, interfaceId },
      query: updateMaskQuery(updateMask),
      jsonBody: updateMask === undefined ? omitUndefined(options) : options,
    }) as AgentInterface
  }
}
