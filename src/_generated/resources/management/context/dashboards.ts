// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../../_config.js'
import type { HttpClient } from '../../../../_http.js'
import { asRecord, invokeWithRetry } from '../../../../_request.js'
import { validateId } from '../../../../_validation.js'
import type {
  Dashboard,
  DashboardDraftSnapshot,
  DashboardVersion,
} from '../../../../types/context-dashboards.js'

/** Generated base for the management `context.dashboards` resource. */
export class ContextDashboardsResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
  ) {}

  /**
   * Delete a dashboard.
   *
   * Removes the dashboard from every listing and deletes its alert workflows. It cannot be restored
   * through the API.
   *
   * **Requires:** `context:write`
   *
   * @param dashboardId - Dashboard id, as shown in the app URL.
   *
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
   * List dashboard draft snapshots.
   *
   * Returns ids and timestamps of the most recent draft snapshots. Editors only.
   *
   * **Requires:** `context:read`
   *
   * @param dashboardId - Dashboard id, as shown in the app URL.
   *
   * @example
   * ```ts
   * const snapshots = await mgmt.context.dashboards.listDraftSnapshots('DASHBOARD_ID')
   * snapshots.map((snapshot) => snapshot.uid)
   * ```
   */
  async listDraftSnapshots(dashboardId: string): Promise<DashboardDraftSnapshot[]> {
    validateId(dashboardId, 'dashboardId')
    const data = await invokeWithRetry(this.config, this.http, 'DashboardsController_listDraftSnapshots', {
      pathParams: { dashboardId },
    })
    return asRecord(data).snapshots as DashboardDraftSnapshot[]
  }

  /**
   * Cancel an ownership transfer.
   *
   * Owner only. Clears the pending transfer and returns the dashboard.
   *
   * **Requires:** `context:write`
   *
   * @param dashboardId - Dashboard id, as shown in the app URL.
   *
   * @example
   * ```ts
   * await mgmt.context.dashboards.cancelOwnershipTransfer('DASHBOARD_ID')
   * ```
   */
  async cancelOwnershipTransfer(dashboardId: string): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    const data = await invokeWithRetry(this.config, this.http, 'DashboardsController_cancelOwnership', {
      pathParams: { dashboardId },
    })
    return asRecord(data) as unknown as Dashboard
  }

  /**
   * Accept an ownership transfer.
   *
   * Recipient only. Makes you the owner and clears the pending transfer.
   *
   * **Requires:** `context:write`
   *
   * @param dashboardId - Dashboard id, as shown in the app URL.
   *
   * @example
   * ```ts
   * await mgmt.context.dashboards.acceptOwnershipTransfer('DASHBOARD_ID')
   * ```
   */
  async acceptOwnershipTransfer(dashboardId: string): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    const data = await invokeWithRetry(this.config, this.http, 'DashboardsController_acceptOwnership', {
      pathParams: { dashboardId },
    })
    return asRecord(data) as unknown as Dashboard
  }

  /**
   * List dashboard versions.
   *
   * Returns the published versions, newest first, each with its full definition. Draft snapshots
   * are not included. The response is not paginated and can be large.
   *
   * **Requires:** `context:read`
   *
   * @param dashboardId - Dashboard id, as shown in the app URL.
   *
   * @example
   * ```ts
   * const versions = await mgmt.context.dashboards.listVersions('DASHBOARD_ID')
   * versions.map((version) => [version.uid, version.versionNumber])
   * ```
   */
  async listVersions(dashboardId: string): Promise<DashboardVersion[]> {
    validateId(dashboardId, 'dashboardId')
    const data = await invokeWithRetry(this.config, this.http, 'DashboardsController_listVersions', {
      pathParams: { dashboardId },
    })
    return asRecord(data).versions as DashboardVersion[]
  }

  /**
   * Get a dashboard version.
   *
   * Returns the dashboard as it was in the given version. For a draft snapshot (editors only) the
   * view is reported as active and selectedVersion.versionNumber is null.
   *
   * **Requires:** `context:read`
   *
   * @param dashboardId - Dashboard id, as shown in the app URL.
   * @param versionId - Version id, or a draft snapshot id for editors.
   *
   * @example
   * ```ts
   * const old = await mgmt.context.dashboards.getVersion('DASHBOARD_ID', 'VERSION_ID')
   * old.selectedVersion.versionNumber
   * ```
   */
  async getVersion(
    dashboardId: string,
    versionId: string,
  ): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    validateId(versionId, 'versionId')
    const data = await invokeWithRetry(this.config, this.http, 'DashboardsController_getVersion', {
      pathParams: { dashboardId, versionId },
    })
    return asRecord(data) as unknown as Dashboard
  }

  /**
   * Restore a dashboard version.
   *
   * Replaces the current draft with the content of the given version. The outgoing draft is kept as
   * a draft snapshot. Returns the draft view.
   *
   * **Requires:** `context:write`
   *
   * @param dashboardId - Dashboard id, as shown in the app URL.
   * @param versionId - Version id, or a draft snapshot id for editors.
   *
   * @example
   * ```ts
   * await mgmt.context.dashboards.restoreVersion('DASHBOARD_ID', 'VERSION_ID')
   * ```
   */
  async restoreVersion(
    dashboardId: string,
    versionId: string,
  ): Promise<Dashboard> {
    validateId(dashboardId, 'dashboardId')
    validateId(versionId, 'versionId')
    const data = await invokeWithRetry(this.config, this.http, 'DashboardsController_restore', {
      pathParams: { dashboardId, versionId },
    })
    return asRecord(data) as unknown as Dashboard
  }
}
