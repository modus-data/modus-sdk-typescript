// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../../_config.js'
import type { HttpClient } from '../../../../_http.js'
import { invokeWithRetry } from '../../../../_request.js'
import { validateId } from '../../../../_validation.js'
import type {
  SetSupervisionRequest,
  Supervision,
} from '../../../../management/scopes/supervision.js'
import type { VariationView } from '../../../../types/views.js'

/** Generated base for the management `scopes.supervision` resource. */
export class ScopesSupervisionResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
    protected readonly scopeId: number | string,
  ) {}

  /**
   * Read the scope subordinate supervision list.
   *
   * Returns the list of subordinate scope ids managed by this scope. `?view=active` (default) reads
   * the deployed supervision set; `?view=draft` reads the most recent builder snapshot. Returns 404
   * when the caller cannot at least `use` the scope.
   *
   * **Requires:** `scopes:read`
   *
   * @param options.view - Which variation snapshot to read. Defaults to `active`.
   */
  async get(options: { view?: VariationView } = {}): Promise<Supervision> {
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'ScopeSupervisionController_get', {
      pathParams: { id: this.scopeId },
      query: { view: options.view },
    })
    return data as Supervision
  }

  /**
   * Replace draft subordinate supervision list.
   *
   * Writes the supplied subordinate id list into the draft variation. Replaces the previous list
   * fully — supply an empty array to clear all subordinates. Requires manage permission on the
   * supervisor; the change is not visible to runners until the scope is deployed.
   *
   * **Requires:** `scopes:write`
   *
   * @param request - Request body; see `SetSupervisionRequest`.
   */
  async set(request: SetSupervisionRequest): Promise<Supervision> {
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'ScopeSupervisionController_set', {
      pathParams: { id: this.scopeId },
      jsonBody: request,
    })
    return data as Supervision
  }

  /**
   * Replace active subordinate supervision list.
   *
   * Writes directly into the active variation supervision set, bypassing the draft deploy cycle.
   * Requires `scopes:write` plus manage permission on the supervisor. Use to correct a live
   * supervision graph without going through the builder.
   *
   * **Requires:** `scopes:write`
   *
   * @param request - Request body; see `SetSupervisionRequest`.
   */
  async setActive(request: SetSupervisionRequest): Promise<Supervision> {
    validateId(this.scopeId, 'scope_id')
    const data = await invokeWithRetry(this.config, this.http, 'ScopeSupervisionController_setActive', {
      pathParams: { id: this.scopeId },
      jsonBody: request,
    })
    return data as Supervision
  }
}
