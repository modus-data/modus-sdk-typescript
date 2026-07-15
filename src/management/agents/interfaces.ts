import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { updateMaskQuery } from '../../_query.js'
import { invokeWithRetry, omitUndefined } from '../../_request.js'
import { validateId } from '../../_validation.js'
import type { components } from '../../_generated/v1.js'

export type AgentInterface = components['schemas']['AgentInterfaceDto']
export type AddAgentInterface = components['schemas']['AddAgentInterfaceDto']
export type UpdateAgentInterface = components['schemas']['UpdateAgentInterfaceDto']

export class WorkflowInterfacesResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
    private readonly workflowId: number | string,
  ) {}

  async list(): Promise<AgentInterface[]> {
    validateId(this.workflowId, 'workflow_id')
    const data = await invokeWithRetry(this.config, this.http, 'WorkflowInterfacesController_list', {
      pathParams: { id: this.workflowId },
    }) as { interfaces: AgentInterface[] }
    return data.interfaces
  }

  async create(options: AddAgentInterface): Promise<AgentInterface> {
    validateId(this.workflowId, 'workflow_id')
    return await invokeWithRetry(this.config, this.http, 'WorkflowInterfacesController_add', {
      pathParams: { id: this.workflowId },
      jsonBody: omitUndefined(options),
    }) as AgentInterface
  }

  async update(interfaceId: string, options: UpdateAgentInterface, updateMask?: string): Promise<AgentInterface> {
    validateId(this.workflowId, 'workflow_id')
    validateId(interfaceId, 'interface_id')
    return await invokeWithRetry(this.config, this.http, 'WorkflowInterfacesController_update', {
      pathParams: { id: this.workflowId, interfaceId },
      query: updateMaskQuery(updateMask),
      jsonBody: updateMask === undefined ? omitUndefined(options) : options,
    }) as AgentInterface
  }

  async delete(interfaceId: string): Promise<void> {
    validateId(this.workflowId, 'workflow_id')
    validateId(interfaceId, 'interface_id')
    await invokeWithRetry(this.config, this.http, 'WorkflowInterfacesController_delete', {
      pathParams: { id: this.workflowId, interfaceId },
    })
  }

  async deleteAll(): Promise<void> {
    validateId(this.workflowId, 'workflow_id')
    await invokeWithRetry(this.config, this.http, 'WorkflowInterfacesController_deleteAll', {
      pathParams: { id: this.workflowId },
    })
  }
}
