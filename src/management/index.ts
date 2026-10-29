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
export type { ModusConfig } from '../_config.js'
export type { ManagementScopesResource } from './scopes/skills.js'
export type { ScopeMemoriesResource } from './scopes/memories.js'
export type { ScopeEvaluationsResource } from './scopes/evaluations.js'
export type { ScopeSupervisionResource, SetSupervisionRequest, Supervision } from './scopes/supervision.js'
export type {
  AddScopeInterface,
  ScopeInterface,
  ScopeInterfacesResource,
  UpdateScopeInterface,
} from './scopes/interfaces.js'
export type { ManagementWorkflowsResource } from './workflows/agents.js'
export type {
  AddAgentInterface,
  AgentInterface,
  UpdateAgentInterface,
  WorkflowInterfacesResource,
} from './workflows/interfaces.js'
export type { ManagementContextResource } from './context/context.js'
export type { ManagementContextItemsResource } from './context/items.js'
export type { BatchUploadOptions, ManagementContextFilesResource } from './context/files.js'
export type { ManagementDashboardElementsResource, ManagementDashboardsResource } from './context/dashboards.js'
export type { ManagementUsageResource } from './usage.js'
export type { ManagementToolsResource } from './tools.js'
export type { ManagementUsersResource, MemberGroup, OrgMember } from './users.js'
export type {
  AddEvaluationCase,
  EvaluationCase,
  EvaluationConfig,
  EvaluationRun,
  EvaluationRunWithResults,
  TriggerEvaluationRunResponse,
  UpdateEvaluationCase,
  UpdateEvaluationConfig,
} from './types/evaluations.js'
export type { JsonObjectInput, JsonObjectListInput } from './types/json-blob.js'
export type { CreatedContextItem } from '../types/context.js'
export type { ToolCatalogEntry } from '../types/tools.js'
export type {
  UsageBucket,
  UsageReport,
  UsageRollup,
  UsageTotals,
  UsageUser,
  UsageUsersReport,
} from '../types/usage.js'
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
  ContextItemAccessUpdate,
  ContextItemDeletion,
  ContextItemMove,
  UpdateContextItemAccessInput,
} from '../types/context.js'
export type {
  BulkFinalizeResult,
  BulkUploadFromUrlsResult,
  BulkUploadUrlsResult,
  FinalizeInput,
  FailedUploadFromUrl,
  FailedUploadUrl,
  FinalizeFailure,
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
export type {
  CreateDashboardElementInput,
  CreateDashboardInput,
  Dashboard,
  DashboardDraftSnapshot,
  DashboardElementKind,
  DashboardElementLayout,
  DashboardElementPatch,
  DashboardElementResult,
  DashboardElementsList,
  DashboardElementSummary,
  DashboardLayoutElement,
  DashboardPublishResult,
  DashboardVersion,
  DashboardView,
  PublishDashboardInput,
  TransferDashboardOwnershipInput,
  UpdateDashboardAccessInput,
  UpdateDashboardDraftInput,
  UpdateDashboardElementInput,
  UpdateDashboardLayoutInput,
} from '../types/context-dashboards.js'
export type { ToolsetInput } from './types/toolset.js'
export type {
  Memory,
  MemorySearchRequest,
  MemorySearchResult,
  MemoryUpdate,
} from './types/memories.js'
