import type { ModusConfig } from '../../_config.js'
import type { HttpClient } from '../../_http.js'
import { asRecord, invokeWithRetry } from '../../_request.js'
import { validateId } from '../../_validation.js'
import type {
  CreateDashboardElementInput,
  CreateDashboardInput,
  Dashboard,
  DashboardDraftSnapshot,
  DashboardElementResult,
  DashboardElementsList,
  DashboardPublishResult,
  DashboardVersion,
  DashboardView,
  PublishDashboardInput,
  TransferDashboardOwnershipInput,
  UpdateDashboardAccessInput,
  UpdateDashboardDraftInput,
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
 * - `list()`, `get()`, `create()`, `updateDraft()`, `publish()`, `delete()` — dashboards.
 * - `listVersions()`, `getVersion()`, `restoreVersion()`, `listDraftSnapshots()` — history.
 * - `updateAccess()` — who can open and edit a dashboard.
 * - `requestOwnershipTransfer()`, `acceptOwnershipTransfer()`, `cancelOwnershipTransfer()`.
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
   * List dashboards with their full definitions.
   *
   * @param options.view - `active` (default) lists published dashboards you can open;
   *   `draft` lists the drafts of dashboards you can edit.
   * @returns Every matching dashboard. The list is not paginated.
   * @example
   * ```ts
   * const drafts = await mgmt.context.dashboards.list({ view: 'draft' })
   * drafts.map((dashboard) => [dashboard.id, dashboard.draftRevision])
   * ```
   */
  async list(options: { view?: DashboardView } = {}): Promise<Dashboard[]> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_list', {
        query: { view: options.view },
      }),
    )
    return data.dashboards as Dashboard[]
  }

  /**
   * Get one dashboard with its full definition.
   *
   * @param dashboardId - Id of the dashboard.
   * @param options.view - `active` (default) returns the published version; `draft`
   *   returns the working draft and requires edit access.
   * @returns The dashboard, including `draftRevision` for the next change.
   * @throws NotFoundError - The dashboard does not exist or you cannot open it.
   * @example
   * ```ts
   * const draft = await mgmt.context.dashboards.get('DASHBOARD_ID', { view: 'draft' })
   * draft.draftRevision
   * ```
   */
  async get(dashboardId: string, options: { view?: DashboardView } = {}): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_get', {
        pathParams: { dashboardId },
        query: { view: options.view },
      }),
    ) as unknown as Dashboard
  }

  /**
   * Create a dashboard draft.
   *
   * The new dashboard is not visible to others until you `publish()` it.
   *
   * @param input.title - Dashboard title.
   * @param input.definition - Tiles, filters and layout, for example
   *   `{ tiles: [], filters: [] }`. Element ids must be unique.
   * @param input.description - Optional dashboard description.
   * @param input.access - Optional `visibility`, `groupPermissions` and `sharedWith`.
   *   Defaults to private.
   * @returns The created dashboard in its draft view.
   * @throws ModusError - The definition or access settings are invalid.
   * @example
   * ```ts
   * const dashboard = await mgmt.context.dashboards.create({
   *   title: 'Revenue',
   *   definition: { tiles: [], filters: [] },
   * })
   * dashboard.id
   * ```
   */
  async create(input: CreateDashboardInput): Promise<Dashboard> {
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_create', {
        jsonBody: {
          title: input.title,
          description: input.description,
          definition: input.definition,
          access: input.access,
        },
      }),
    ) as unknown as Dashboard
  }

  /**
   * Replace the whole draft definition, and optionally the title and description.
   *
   * @param dashboardId - Id of the dashboard.
   * @param input.expectedRevision - The `draftRevision` your change is based on.
   * @param input.definition - The complete new definition. Tiles and filters left
   *   out are removed.
   * @param input.title - New title; unchanged when omitted.
   * @param input.description - New description; unchanged when omitted.
   * @returns The dashboard draft after the change, including the new `draftRevision`.
   * @throws ConflictError - The draft changed since `expectedRevision`; get the draft
   *   again and retry with the new revision.
   * @throws NotFoundError - The dashboard does not exist or you cannot edit it.
   * @example
   * ```ts
   * const draft = await mgmt.context.dashboards.get('DASHBOARD_ID', { view: 'draft' })
   * await mgmt.context.dashboards.updateDraft('DASHBOARD_ID', {
   *   expectedRevision: draft.draftRevision,
   *   definition: draft.definition,
   *   title: 'Revenue',
   * })
   * ```
   */
  async updateDraft(dashboardId: string, input: UpdateDashboardDraftInput): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_updateDraft', {
        pathParams: { dashboardId },
        jsonBody: {
          expectedRevision: input.expectedRevision,
          title: input.title,
          description: input.description,
          definition: input.definition,
        },
      }),
    ) as unknown as Dashboard
  }

  /**
   * Publish the draft as a new version that everyone with access sees.
   *
   * Alert workflows defined on the dashboard are updated to match.
   *
   * @param dashboardId - Id of the dashboard.
   * @param input.expectedRevision - The `draftRevision` you reviewed and want to publish.
   * @returns The published `dashboard` and the new `version`.
   * @throws ConflictError - The draft changed since `expectedRevision`.
   * @throws NotFoundError - The dashboard does not exist or you cannot edit it.
   * @example
   * ```ts
   * const result = await mgmt.context.dashboards.publish('DASHBOARD_ID', { expectedRevision: 4 })
   * result.version.versionNumber
   * ```
   */
  async publish(dashboardId: string, input: PublishDashboardInput): Promise<DashboardPublishResult> {
    validateId(dashboardId, 'dashboardId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_publish', {
        pathParams: { dashboardId },
        jsonBody: { expectedRevision: input.expectedRevision },
      }),
    ) as unknown as DashboardPublishResult
  }

  /**
   * Delete a dashboard and the alert workflows defined on it.
   *
   * A deleted dashboard cannot be restored.
   *
   * @param dashboardId - Id of the dashboard.
   * @throws NotFoundError - The dashboard does not exist or you cannot edit it.
   * @example
   * ```ts
   * await mgmt.context.dashboards.delete('DASHBOARD_ID')
   * ```
   */
  async delete(dashboardId: string): Promise<void> {
    validateId(dashboardId, 'dashboardId')
    await invokeWithRetry(this.config, this.http, 'DashboardsController_delete', {
      pathParams: { dashboardId },
    })
  }

  /**
   * List the published versions of a dashboard, newest first.
   *
   * @param dashboardId - Id of the dashboard.
   * @returns Every published version with its full definition. Definitions are
   *   returned as stored, so older versions may lack newer fields. The list is
   *   not paginated.
   * @throws NotFoundError - The dashboard does not exist or you cannot open it.
   * @example
   * ```ts
   * const versions = await mgmt.context.dashboards.listVersions('DASHBOARD_ID')
   * versions.map((version) => [version.uid, version.versionNumber])
   * ```
   */
  async listVersions(dashboardId: string): Promise<DashboardVersion[]> {
    validateId(dashboardId, 'dashboardId')
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_listVersions', {
        pathParams: { dashboardId },
      }),
    )
    return data.versions as DashboardVersion[]
  }

  /**
   * Get a dashboard as it was in one version.
   *
   * @param dashboardId - Id of the dashboard.
   * @param versionId - Id of the version, as returned by `listVersions()`.
   * @returns The dashboard with that version's definition.
   * @throws NotFoundError - The dashboard or the version does not exist, or you cannot
   *   open the dashboard.
   * @example
   * ```ts
   * const old = await mgmt.context.dashboards.getVersion('DASHBOARD_ID', 'VERSION_ID')
   * old.selectedVersion.versionNumber
   * ```
   */
  async getVersion(dashboardId: string, versionId: string): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    validateId(versionId, 'versionId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_getVersion', {
        pathParams: { dashboardId, versionId },
      }),
    ) as unknown as Dashboard
  }

  /**
   * Replace the draft with the content of an earlier version.
   *
   * The draft being replaced is kept as a draft snapshot. Call `publish()`
   * afterwards to make the restored content visible.
   *
   * @param dashboardId - Id of the dashboard.
   * @param versionId - Id of the version or draft snapshot to restore.
   * @returns The dashboard draft after the restore.
   * @throws NotFoundError - The dashboard or the version does not exist, or you cannot
   *   edit the dashboard.
   * @example
   * ```ts
   * await mgmt.context.dashboards.restoreVersion('DASHBOARD_ID', 'VERSION_ID')
   * ```
   */
  async restoreVersion(dashboardId: string, versionId: string): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    validateId(versionId, 'versionId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_restore', {
        pathParams: { dashboardId, versionId },
      }),
    ) as unknown as Dashboard
  }

  /**
   * List recent snapshots of the dashboard draft, newest first.
   *
   * @param dashboardId - Id of the dashboard.
   * @returns Up to 100 snapshots with their id, author and time. Pass an id to
   *   `restoreVersion()` to bring that draft back.
   * @throws NotFoundError - The dashboard does not exist or you cannot edit it.
   * @example
   * ```ts
   * const snapshots = await mgmt.context.dashboards.listDraftSnapshots('DASHBOARD_ID')
   * snapshots.map((snapshot) => snapshot.uid)
   * ```
   */
  async listDraftSnapshots(dashboardId: string): Promise<DashboardDraftSnapshot[]> {
    validateId(dashboardId, 'dashboardId')
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_listDraftSnapshots', {
        pathParams: { dashboardId },
      }),
    )
    return data.snapshots as DashboardDraftSnapshot[]
  }

  /**
   * Replace who can open and edit a dashboard.
   *
   * All three settings are required and replace the current ones.
   *
   * @param dashboardId - Id of the dashboard.
   * @param input.visibility - `shared` (the owner plus the groups in
   *   `groupPermissions`) or `private` (the owner plus the users in `sharedWith`).
   * @param input.groupPermissions - Group id to `{ use, manage }`. Used only when shared.
   * @param input.sharedWith - Users such as `{ email: 'ana@example.com', permission: 'use' }`.
   *   Used only when private.
   * @returns The dashboard with its new access settings.
   * @throws NotFoundError - The dashboard does not exist or you cannot edit it.
   * @throws ModusError - A group, user or permission is invalid.
   * @example
   * ```ts
   * await mgmt.context.dashboards.updateAccess('DASHBOARD_ID', {
   *   visibility: 'private',
   *   groupPermissions: {},
   *   sharedWith: [{ email: 'ana@example.com', permission: 'use' }],
   * })
   * ```
   */
  async updateAccess(dashboardId: string, input: UpdateDashboardAccessInput): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_updateAccess', {
        pathParams: { dashboardId },
        jsonBody: {
          visibility: input.visibility,
          groupPermissions: input.groupPermissions,
          sharedWith: input.sharedWith,
        },
      }),
    ) as unknown as Dashboard
  }

  /**
   * Ask another member of your organization to take ownership of a dashboard.
   *
   * Only the owner can request a transfer. Ownership moves when the recipient
   * calls `acceptOwnershipTransfer()`.
   *
   * @param dashboardId - Id of the dashboard.
   * @param input.newOwnerUserId - User id of the member who should become the owner.
   * @returns The dashboard with `pendingOwnershipTransfer` set.
   * @throws PermissionDeniedError - You are not the owner.
   * @throws NotFoundError - The dashboard does not exist or you cannot open it.
   * @example
   * ```ts
   * await mgmt.context.dashboards.requestOwnershipTransfer('DASHBOARD_ID', {
   *   newOwnerUserId: 'USER_ID',
   * })
   * ```
   */
  async requestOwnershipTransfer(
    dashboardId: string,
    input: TransferDashboardOwnershipInput,
  ): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    validateId(input.newOwnerUserId, 'newOwnerUserId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_transferOwnership', {
        pathParams: { dashboardId },
        jsonBody: { newOwnerUserId: input.newOwnerUserId },
      }),
    ) as unknown as Dashboard
  }

  /**
   * Accept a pending ownership transfer and become the dashboard owner.
   *
   * Only the requested recipient can accept.
   *
   * @param dashboardId - Id of the dashboard.
   * @returns The dashboard with you as its owner.
   * @throws NotFoundError - The dashboard does not exist, or it has no pending transfer
   *   addressed to you.
   * @example
   * ```ts
   * await mgmt.context.dashboards.acceptOwnershipTransfer('DASHBOARD_ID')
   * ```
   */
  async acceptOwnershipTransfer(dashboardId: string): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_acceptOwnership', {
        pathParams: { dashboardId },
      }),
    ) as unknown as Dashboard
  }

  /**
   * Cancel a pending ownership transfer.
   *
   * Only the owner can cancel.
   *
   * @param dashboardId - Id of the dashboard.
   * @returns The dashboard with no pending transfer.
   * @throws NotFoundError - The dashboard does not exist, you cannot open it, or you are
   *   not the owner.
   * @example
   * ```ts
   * await mgmt.context.dashboards.cancelOwnershipTransfer('DASHBOARD_ID')
   * ```
   */
  async cancelOwnershipTransfer(dashboardId: string): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    return asRecord(
      await invokeWithRetry(this.config, this.http, 'DashboardsController_cancelOwnership', {
        pathParams: { dashboardId },
      }),
    ) as unknown as Dashboard
  }

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
