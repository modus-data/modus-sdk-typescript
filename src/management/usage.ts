import { UsageResourceBase } from '../_generated/resources/management/usage.js'
import { invokeWithRetry } from '../_request.js'
import type { UsageReport, UsageRollup } from '../types/usage.js'

export class ManagementUsageResource extends UsageResourceBase {
  /**
   * List usage metrics for your organization over a time window.
   *
   * @param options.since - Start of the window (ISO 8601, inclusive).
   * @param options.until - End of the window (ISO 8601, exclusive).
   * @param options.rollup - Bucket size for each row: `"hour"` or `"day"`.
   * @param options.model - Optional filter to a single model name.
   * @param options.userEmail - Optional filter to one or more acting-user emails.
   * @returns Usage report rows for the window.
   * @throws {UnprocessableError} When the request is rejected by the API.
   * @throws {AuthenticationError} When the API key is invalid or missing.
   */
  async list(options: {
    since: string
    until: string
    rollup: UsageRollup
    model?: string
    userEmail?: readonly string[]
  }): Promise<UsageReport> {
    const query: Record<string, string | string[]> = {
      since: options.since,
      until: options.until,
      rollup: options.rollup,
    }
    if (options.model !== undefined) query.model = options.model
    if (options.userEmail !== undefined) query.user_email = [...options.userEmail]
    const data = await invokeWithRetry(this.config, this.http, 'UsageController_list', { query })
    return data as UsageReport
  }
}
