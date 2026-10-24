// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../../../_config.js'
import type { HttpClient } from '../../../../../_http.js'
import { asRecord, invokeWithRetry } from '../../../../../_request.js'
import { validateId } from '../../../../../_validation.js'
import type {
  DashboardElementResult,
  DashboardElementsList,
} from '../../../../../types/context-dashboards.js'

/** Generated base for the management `context.dashboards.elements` resource. */
export class ContextDashboardsElementsResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
    protected readonly dashboardId: number | string,
  ) {}

  /**
   * List dashboard elements.
   *
   * Lists every tile and filter on the dashboard draft with id, kind, title and layout. Filters
   * also carry sqlReferences, the exact templates tile SQL must use to reference them. Returns the
   * current draftRevision.
   *
   * **Requires:** `context:read`
   *
   * @example
   * ```ts
   * const listed = await mgmt.context.dashboards.elements('DASHBOARD_ID').list()
   * listed.elements.map((element) => element.id)
   * ```
   */
  async list(): Promise<DashboardElementsList> {
    const data = await invokeWithRetry(this.config, this.http, 'DashboardsController_listElements', {
      pathParams: { dashboardId: this.dashboardId },
    })
    return asRecord(data) as unknown as DashboardElementsList
  }

  /**
   * Get a dashboard element.
   *
   * Returns the full draft configuration of one dashboard element, including SQL, chart settings
   * and filter options, with the current draftRevision.
   *
   * **Requires:** `context:read`
   *
   * @param elementId - The dashboard element id to read.
   *
   * @example
   * ```ts
   * const result = await mgmt.context.dashboards.elements('DASHBOARD_ID').get('ELEMENT_ID')
   * result.element.title
   * ```
   */
  async get(elementId: string): Promise<DashboardElementResult> {
    validateId(elementId, 'elementId')
    const data = await invokeWithRetry(this.config, this.http, 'DashboardsController_getElement', {
      pathParams: { dashboardId: this.dashboardId, elementId },
    })
    return asRecord(data) as unknown as DashboardElementResult
  }
}
