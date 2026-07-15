import type { ModusConfig } from '../_config.js'
import type { components } from '../_generated/v1.js'
import type { HttpClient } from '../_http.js'
import { invokeWithRetry } from '../_request.js'

export type MemberGroup = components['schemas']['MemberGroupDto']
export type OrgMember = components['schemas']['OrgMemberDto']

export class ManagementUsersResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  async listMemberGroups(): Promise<MemberGroup[]> {
    const data = (await invokeWithRetry(
      this.config, this.http, 'MemberGroupsController_list',
    )) as { groups: MemberGroup[] }
    return data.groups
  }

  async listOrgMembers(): Promise<OrgMember[]> {
    const data = (await invokeWithRetry(
      this.config, this.http, 'OrgMembersController_list',
    )) as { members: OrgMember[] }
    return data.members
  }
}
