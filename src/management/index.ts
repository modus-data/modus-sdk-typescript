import { ModusClientBase } from '../_client-base.js'
import type { ModusOptions } from '../_config.js'
import { ManagementWorkflowsResource } from './agents/agents.js'
import { ManagementContextResource } from './context/context.js'
import { ManagementOrganizationResource } from './organization.js'
import { ManagementScopesResource } from './skills/skills.js'
import { ManagementUsageResource } from './usage.js'
import { ManagementUsersResource } from './users.js'

/** Configure scopes, workflows, context, usage, and organization settings. */
export class ModusManagement extends ModusClientBase {
  readonly scopes: ManagementScopesResource
  readonly workflows: ManagementWorkflowsResource
  readonly context: ManagementContextResource
  readonly usage: ManagementUsageResource
  readonly organization: ManagementOrganizationResource
  readonly users: ManagementUsersResource

  constructor(options: ModusOptions = {}) {
    super(options)
    this.scopes = new ManagementScopesResource(this.http, this.config)
    this.workflows = new ManagementWorkflowsResource(this.http, this.config)
    this.context = new ManagementContextResource(this.http, this.config)
    this.usage = new ManagementUsageResource(this.http, this.config)
    this.organization = new ManagementOrganizationResource(this.http, this.config)
    this.users = new ManagementUsersResource(this.http, this.config)
  }
}

export type { ModusOptions }
export type { CreateSkillOptions, UpdateSkillOptions } from './skills/skills.js'
export type {
  CreateAgentOptions,
  UpdateAgentOptions,
  TriggerInput,
  AgentSelectionInput,
  WorkflowGraphInput,
} from './agents/agents.js'
export type { UserFeedback } from './context/context.js'
export type { ToolsetInput } from './types/toolset.js'
export type {
  Memory,
  MemorySearchRequest,
  MemorySearchResult,
  MemoryUpdate,
} from './types/memories.js'
