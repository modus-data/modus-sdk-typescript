// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../../_config.js'
import type { HttpClient } from '../../../../_http.js'
import { invokeWithRetry } from '../../../../_request.js'
import { validateId } from '../../../../_validation.js'
import type { ScopeInterface } from '../../../../management/scopes/interfaces.js'

/** Generated base for the management `scopes.interfaces` resource. */
export class ScopesInterfacesResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
    protected readonly scopeId: number | string,
  ) {}

  /**
   * List the chat interfaces of a scope.
   *
   * Returns the chat interfaces (at most one per chat platform) that let people use this scope from
   * chat. Requires manage permission on the scope, because the config lists allowed emails.
   *
   * **Requires:** `scopes:read`
   */
  async list(): Promise<ScopeInterface[]> {
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'ScopeInterfacesController_list', {
      pathParams: { id: this.scopeId },
    })
    return (data as { interfaces: ScopeInterface[] }).interfaces
  }

  /**
   * Remove a scope interface.
   *
   * Removes one chat interface from the scope. Mentions on that chat platform stop reaching this
   * scope immediately.
   *
   * **Requires:** `scopes:write`
   *
   * @param interfaceId - Interface id (UUID).
   */
  async delete(interfaceId: string): Promise<void> {
    validateId(this.scopeId, 'scope_id')
    validateId(interfaceId, 'interface_id')
    await invokeWithRetry(this.config, this.http, 'ScopeInterfacesController_delete', {
      pathParams: { id: this.scopeId, interfaceId },
    })
  }
}
