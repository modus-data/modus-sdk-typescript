import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { invokeWithRetry } from '../../_request.js'
import { validateId } from '../../_validation.js'
import type { components } from '../../_generated/v1.js'
import type { VariationView } from '../../types/views.js'

export type Supervision = components['schemas']['SupervisionDto']
export type SetSupervisionRequest = components['schemas']['SetSupervisionRequestDto']

export class ScopeSupervisionResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
    private readonly scopeId: number | string,
  ) {}

  /**
   * Get this scope's supervision configuration.
   *
   * @param options.view - Optional scope variation to inspect.
   * @returns The supervision configuration.
   */
  async get(options: { view?: VariationView } = {}): Promise<Supervision> {
    validateId(this.scopeId, 'scope_id')
    return await invokeWithRetry(this.config, this.http, 'ScopeSupervisionController_get', {
      pathParams: { id: this.scopeId },
      query: options.view === undefined ? undefined : { view: options.view },
    }) as Supervision
  }

  /**
   * Replace this scope's subordinate scopes.
   *
   * @param request - Replacement supervision configuration.
   * @returns The updated supervision configuration.
   */
  async set(request: SetSupervisionRequest): Promise<Supervision> {
    return this.write('ScopeSupervisionController_set', request)
  }

  /**
   * Replace subordinate scopes on the active (deployed) scope version.
   *
   * @param request - Replacement supervision configuration.
   * @returns The updated supervision configuration.
   */
  async setActive(request: SetSupervisionRequest): Promise<Supervision> {
    return this.write('ScopeSupervisionController_setActive', request)
  }

  private async write(operation: 'ScopeSupervisionController_set' | 'ScopeSupervisionController_setActive',
    request: SetSupervisionRequest): Promise<Supervision> {
    validateId(this.scopeId, 'scope_id')
    return await invokeWithRetry(this.config, this.http, operation, {
      pathParams: { id: this.scopeId },
      jsonBody: request,
    }) as Supervision
  }
}
