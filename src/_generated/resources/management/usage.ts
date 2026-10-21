// Auto-generated resource bases. Do not edit by hand.

import type { ModusConfig } from '../../../_config.js'
import type { HttpClient } from '../../../_http.js'
import { invokeWithRetry } from '../../../_request.js'
import type { UsageUsersReport } from '../../../types/usage.js'

/** Generated base for the management `usage` resource. */
export class UsageResourceBase {
  /** @internal */
  constructor(
    protected readonly http: HttpClient,
    protected readonly config: ModusConfig,
  ) {}

  /**
   * List usage users.
   *
   * Returns the distinct acting-user emails that appear in your organization's LLM usage over the
   * `[since, until)` window. Feeds the usage page's user filter (includes non-Modus Slack/Teams
   * users). Scoped to your organization.
   *
   * **Requires:** `usage:read`
   *
   * @param options.since - ISO8601 start of the query window (inclusive).
   * @param options.until - ISO8601 end of the query window (exclusive).
   */
  async listUsers(options: { since: string; until: string }): Promise<UsageUsersReport> {
    const data = await invokeWithRetry(this.config, this.http, 'UsageController_listUsers', {
      query: { since: options.since, until: options.until },
    })
    return data as UsageUsersReport
  }
}
