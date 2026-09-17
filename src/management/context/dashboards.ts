import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { asRecord, invokeWithRetry } from '../../_request.js'
import { validateId } from '../../_validation.js'
import type {
  CreateDashboardElementInput,
  Dashboard,
  DashboardElementResult,
  DashboardElementsList,
  UpdateDashboardElementInput,
  UpdateDashboardLayoutInput,
} from '../../types/context-dashboards.js'

/**
 * Tiles and filters on one dashboard draft.
 *
 * Call path: `mgmt.context.dashboards.elements(dashboardId)`.
 *
 * Every change takes the `draftRevision` it is based on as `expectedRevision`;
 * a stale value is rejected with a `ConflictError`.
 */
export class ManagementDashboardElementsResource {
  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
    private readonly dashboardId: string,
  ) {}

  /**
   * List every tile and filter on the dashboard draft.
   *
   * @returns Each element's id, kind, title and grid position, plus the current
   *   `draftRevision` to pass as `expectedRevision` on the next change.
   * @throws NotFoundError - The dashboard does not exist or you cannot edit it.
   * @example
   * ```ts
   * const listed = await mgmt.context.dashboards.elements('DASHBOARD_ID').list()
   * listed.elements.map((element) => element.id)
   * ```
   */
  async list(): Promise<DashboardElementsList> {
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_listElements', {
        pathParams: { dashboardId: this.dashboardId },
      }),
    ) as unknown as DashboardElementsList
  }

  /**
   * Get the full draft settings of one tile or filter.
   *
   * @param elementId - Id of the tile or filter, as returned by `list()`.
   * @returns The element's settings and the current `draftRevision`.
   * @throws NotFoundError - The dashboard or the element does not exist, or you cannot
   *   edit the dashboard.
   * @example
   * ```ts
   * const result = await mgmt.context.dashboards.elements('DASHBOARD_ID').get('ELEMENT_ID')
   * result.element.title
   * ```
   */
  async get(elementId: string): Promise<DashboardElementResult> {
    validateId(elementId, 'elementId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_getElement', {
        pathParams: { dashboardId: this.dashboardId, elementId },
      }),
    ) as unknown as DashboardElementResult
  }

  /**
   * Add a blank tile or filter to the dashboard draft.
   *
   * Modus assigns the new element's id; configure it afterwards with `update()`.
   *
   * @param input.expectedRevision - The `draftRevision` your change is based on.
   * @param input.kind - `chart`, `kpi`, `table`, `markdown` or `filter`.
   * @param input.title - Title shown on the element.
   * @param input.layout - Grid position with `x` (0-11), `y`, `w` (1-12) and `h`.
   * @returns The created element and the new `draftRevision`.
   * @throws ConflictError - The draft changed since `expectedRevision`; list the
   *   elements again and retry with the new revision.
   * @example
   * ```ts
   * const created = await mgmt.context.dashboards.elements('DASHBOARD_ID').create({
   *   expectedRevision: 3,
   *   kind: 'chart',
   *   title: 'Sales by region',
   *   layout: { x: 0, y: 4, w: 6, h: 4 },
   * })
   * ```
   */
  async create(input: CreateDashboardElementInput): Promise<DashboardElementResult> {
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_createElement', {
        pathParams: { dashboardId: this.dashboardId },
        jsonBody: {
          expectedRevision: input.expectedRevision,
          kind: input.kind,
          title: input.title,
          layout: input.layout,
        },
      }),
    ) as unknown as DashboardElementResult
  }

  /**
   * Change settings of one tile or filter on the dashboard draft.
   *
   * @param elementId - Id of the tile or filter to change.
   * @param input.expectedRevision - The `draftRevision` your change is based on.
   * @param input.patch - The settings to change, for example `{ title: 'Sales' }`
   *   or `{ defaultValue: null }`. `null` clears a setting that supports clearing.
   * @returns The whole dashboard after the change, including the new `draftRevision`.
   * @throws ConflictError - The draft changed since `expectedRevision`.
   * @throws NotFoundError - The dashboard or the element does not exist, or you cannot
   *   edit the dashboard.
   * @example
   * ```ts
   * const dashboard = await mgmt.context.dashboards
   *   .elements('DASHBOARD_ID')
   *   .update('ELEMENT_ID', { expectedRevision: 3, patch: { title: 'Revenue' } })
   * ```
   */
  async update(elementId: string, input: UpdateDashboardElementInput): Promise<Dashboard> {
    validateId(elementId, 'elementId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_updateElement', {
        pathParams: { dashboardId: this.dashboardId, elementId },
        jsonBody: { expectedRevision: input.expectedRevision, patch: input.patch },
      }),
    ) as unknown as Dashboard
  }
}

/**
 * Dashboards in the Modus knowledge base.
 *
 * Call path: `mgmt.context.dashboards` after `new ModusManagement(...)`.
 *
 * - `elements(dashboardId)` — list, get, create and update tiles and filters.
 * - `updateLayout(dashboardId, input)` — move or resize several elements at once.
 */
export class ManagementDashboardsResource {
  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  /**
   * Work with the tiles and filters of one dashboard draft.
   *
   * @param dashboardId - Id of the dashboard.
   * @returns A resource bound to that dashboard.
   * @example
   * ```ts
   * await mgmt.context.dashboards.elements('DASHBOARD_ID').list()
   * ```
   */
  elements(dashboardId: string): ManagementDashboardElementsResource {
    validateId(dashboardId, 'dashboardId')
    return new ManagementDashboardElementsResource(this.http, this.config, dashboardId)
  }

  /**
   * Move or resize several tiles and filters in one change.
   *
   * @param dashboardId - Id of the dashboard.
   * @param input.expectedRevision - The `draftRevision` your change is based on.
   * @param input.elements - Every element to place, each with `elementId` and its
   *   final `layout`.
   * @returns The whole dashboard after the change, including the new `draftRevision`.
   * @throws ConflictError - The draft changed since `expectedRevision`.
   * @example
   * ```ts
   * await mgmt.context.dashboards.updateLayout('DASHBOARD_ID', {
   *   expectedRevision: 3,
   *   elements: [{ elementId: 'ELEMENT_ID', layout: { x: 0, y: 0, w: 12, h: 2 } }],
   * })
   * ```
   */
  async updateLayout(dashboardId: string, input: UpdateDashboardLayoutInput): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_updateLayout', {
        pathParams: { dashboardId },
        jsonBody: { expectedRevision: input.expectedRevision, elements: input.elements },
      }),
    ) as unknown as Dashboard
  }
}
