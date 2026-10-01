import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { updateMaskQuery } from '../../_query.js'
import { invokeWithRetry, omitUndefined } from '../../_request.js'
import { validateId } from '../../_validation.js'
import type { components } from '../../_generated/v1.js'

export type ScopeInterface = components['schemas']['ScopeInterfaceDto']
export type AddScopeInterface = components['schemas']['AddScopeInterfaceDto']
export type UpdateScopeInterface = components['schemas']['UpdateScopeInterfaceDto']

export class ScopeInterfacesResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
    private readonly scopeId: number | string,
  ) {}

  /** List the Slack and Microsoft Teams interfaces on this scope. */
  async list(): Promise<ScopeInterface[]> {
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'ScopeInterfacesController_list', {
      pathParams: { id: this.scopeId },
    }) as { interfaces: ScopeInterface[] }
    return data.interfaces
  }

  /**
   * Add a Slack or Microsoft Teams interface to this scope.
   *
   * @param options - Interface type, optional name and config.
   * @returns The created interface.
   */
  async create(options: AddScopeInterface): Promise<ScopeInterface> {
    validateId(this.scopeId, 'scope_id')
    return await invokeWithRetry(this.config, this.http, 'ScopeInterfacesController_add', {
      pathParams: { id: this.scopeId },
      jsonBody: omitUndefined(options),
    }) as ScopeInterface
  }

  /**
   * Update an interface on this scope.
   *
   * @param interfaceId - Interface id.
   * @param options - Updated name and/or config.
   * @param updateMask - Optional comma-separated field names to update.
   * @returns The updated interface.
   */
  async update(interfaceId: string, options: UpdateScopeInterface, updateMask?: string): Promise<ScopeInterface> {
    validateId(this.scopeId, 'scope_id')
    validateId(interfaceId, 'interface_id')
    return await invokeWithRetry(this.config, this.http, 'ScopeInterfacesController_update', {
      pathParams: { id: this.scopeId, interfaceId },
      query: updateMaskQuery(updateMask),
      jsonBody: updateMask === undefined ? omitUndefined(options) : options,
    }) as ScopeInterface
  }

  /**
   * Remove an interface from this scope.
   *
   * @param interfaceId - Interface id.
   */
  async delete(interfaceId: string): Promise<void> {
    validateId(this.scopeId, 'scope_id')
    validateId(interfaceId, 'interface_id')
    await invokeWithRetry(this.config, this.http, 'ScopeInterfacesController_delete', {
      pathParams: { id: this.scopeId, interfaceId },
    })
  }
}
