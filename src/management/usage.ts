import type { ModusConfig } from '../_config.js'
import type { HttpClient } from '../_http.js'
import { invokeWithRetry } from '../_request.js'
import type { UsageReport, UsageRollup, UsageUsersReport } from '../types/usage.js'

export class ManagementUsageResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

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
