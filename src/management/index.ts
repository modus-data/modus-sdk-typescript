import { ModusClientBase } from '../_client-base.js'
import type { ModusOptions } from '../_config.js'
import { ManagementWorkflowsResource } from './workflows/agents.js'
import { ManagementContextResource } from './context/context.js'
import { ManagementScopesResource } from './scopes/skills.js'
import { ManagementUsageResource } from './usage.js'
import { ManagementToolsResource } from './tools.js'
import { ManagementUsersResource } from './users.js'

/**
 * Configure scopes, workflows, context, usage, tools, and users.
 *
 * Call path: `const mgmt = new ModusManagement(...)` then `mgmt.scopes`, `mgmt.context`, …
 *
 * @param options - Client configuration (`apiKey`, `baseUrl`, `timeoutMs`, `maxRetries`).
 */
export class ModusManagement extends ModusClientBase {
  readonly scopes: ManagementScopesResource
  readonly workflows: ManagementWorkflowsResource
  readonly context: ManagementContextResource
  readonly usage: ManagementUsageResource
  readonly tools: ManagementToolsResource
  readonly users: ManagementUsersResource

  constructor(options: ModusOptions = {}) {
    super(options)
    this.scopes = new ManagementScopesResource(this.http, this.config)
    this.workflows = new ManagementWorkflowsResource(this.http, this.config)
    this.context = new ManagementContextResource(this.http, this.config)
    this.usage = new ManagementUsageResource(this.http, this.config)
    this.tools = new ManagementToolsResource(this.http, this.config)
    this.users = new ManagementUsersResource(this.http, this.config)
  }
}

export type { ModusOptions }
export type {
  CreateScopeOptions,
  UpdateScopeOptions,
  CreateSkillOptions,
  UpdateSkillOptions,
} from './scopes/skills.js'
export type {
  CreateWorkflowOptions,
  UpdateWorkflowOptions,
  CreateAgentOptions,
  UpdateAgentOptions,
  TriggerInput,
  AgentSelectionInput,
  WorkflowGraphInput,
} from './workflows/agents.js'
export type { UserFeedback } from './context/context.js'
export type {
  BulkUploadFromUrlsResult,
  BulkUploadUrlsResult,
  FinalizeInput,
  FailedUploadFromUrl,
  FailedUploadUrl,
  FileUpload,
  FileUploadStatus,
  UploadDirFailure,
  UploadDirResult,
  UploadFileInput,
  UploadFromUrlInput,
  UploadProgress,
  UploadProgressCallback,
  UploadUrlInput,
  UploadUrlSlot,
  WaitUntil,
} from '../types/context-files.js'
export type { ToolsetInput } from './types/toolset.js'
export type {
  Memory,
  MemorySearchRequest,
  MemorySearchResult,
  MemoryUpdate,
} from './types/memories.js'
