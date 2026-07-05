import type { ModusConfig } from '../_config.js'
import type { HttpClient } from '../_http.js'
import { invokeWithRetry } from '../_request.js'

export class ManagementOrganizationResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  async delete(): Promise<void> {
    await invokeWithRetry(this.config, this.http, 'OrganizationController_deleteOrganization')
  }
}
