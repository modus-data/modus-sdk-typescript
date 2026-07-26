import type { ModusConfig } from '../_config.js'
import type { HttpClient } from '../_http.js'
import { invokeWithRetry } from '../_request.js'
import type { UsageReport, UsageRollup, UsageUsersReport } from '../types/usage.js'

export class ManagementUsageResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

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

  /**
   * List distinct acting-user emails observed in a time window.
   *
   * @param options.since - Start of the window (ISO 8601, inclusive).
   * @param options.until - End of the window (ISO 8601, exclusive).
   * @returns User emails seen in usage during the window.
   * @throws {UnprocessableError} When the request is rejected by the API.
   * @throws {AuthenticationError} When the API key is invalid or missing.
   */
  async listUsers(options: { since: string; until: string }): Promise<UsageUsersReport> {
    const query: Record<string, string> = {
      since: options.since,
      until: options.until,
    }
    const data = await invokeWithRetry(this.config, this.http, 'UsageController_listUsers', {
      query,
    })
    return data as UsageUsersReport
  }
}
