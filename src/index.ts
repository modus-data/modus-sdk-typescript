/**
 * @getmodus/sdk — official TypeScript client for Modus.
 */

export type { components, paths, operations } from './_generated/v1.js'
export type { OperationId, OperationSpec } from './_generated/operations.js'
export { OPERATIONS } from './_generated/operations.js'

export {
  APIConnectionError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  ModusError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  RunCancelledError,
  StreamTimeoutError,
  UnprocessableError,
  ValidationError,
} from './_exceptions.js'

export { ChatSession } from './_chat.js'
export type { ChatOptions } from './_chat.js'
export { Page } from './_pagination.js'
export type {
  AssistantContentResetEvent,
  CancelledEvent,
  DoneEvent,
  ErrorEvent,
  RunEvent,
  ApprovalRequiredEvent,
  RunEventBase,
  StreamTimeoutEvent,
  TokenEvent,
} from './types/runs.js'
export type { ChatModel, ChatResult } from './types/chat.js'
export type { ModusOptions } from './_config.js'
export type { Scope, ScopeStatus, ScopeVariation, Skill, SkillStatus, SkillVariation } from './types/scopes.js'
export type { Workflow, Agent } from './types/workflows.js'
export { AgentType, WorkflowType } from './types/workflows.js'
export type {
  AgentRun,
  AgentRunCreateRequest,
  AgentRunListItem,
  ApprovalScope,
  CancelRunRequest,
  CreateAgentRunRequest,
  EditQueuedRunRequest,
  FollowUpRunRequest,
  InterruptRunRequest,
  ModusRunCreateRequest,
  ResumeRunRequest,
  RunAdmission,
  RunStatus,
  RunTimeframe,
  SkillRunCreateRequest,
  WorkflowActionRequest,
} from './types/agent-runs.js'
export type { AgentRunStream } from './resources/workflows/runs.js'
export type {
  Conversation,
  ConversationKind,
  ConversationListItem,
  Message,
} from './types/conversations.js'
export { conversationScopeId, conversationSkillId } from './types/conversations.js'
export type { Connection, ConnectionSelection } from './types/connections.js'
export type { SupervisionView, VariationView } from './types/views.js'
export type {
  ContextItem,
  ContextItemAncestor,
  ContextItemDeletion,
  ContextItemLookupRow,
  ContextItemsQuery,
  ContextItemsQueryResult,
  ContextItemMove,
  ContextItemAccessUpdate,
  UpdateContextItemAccessInput,
  ContextType,
} from './types/context.js'
export type { ContextValueRow } from './types/context-values.js'
export type {
  ComposeSkillContextRequest,
  ModusContextComposition,
  ModusContextRequest,
  SkillContextComposition,
} from './types/context-compose.js'
export type {
  RecordSuggestionEventRequest,
  SuggestionEventSource,
  SuggestionEventType,
  SuggestionQuestion,
} from './types/suggestions.js'
export type {
  HttpIngestedDataRequest,
  IngestedDataRequest,
  IngestedDataResponse,
  IngestedDataResponseFormat,
  IngestedDataUploadResult,
  SqlIngestedDataRequest,
  UploadIngestedDataOptions,
} from './types/ingested-data.js'

export type { ModusConfig } from './_config.js'
export type { ActiveConversationRun, ActiveConversationRunStatus } from './types/runs.js'
export type { RunEventsPollResponse } from './types/agent-runs.js'
export type { ContentProjection, JsonObjectInput } from './types/json-blob.js'
export type {
  CreateCustomContextItemInput,
  CreatedCustomContextItem,
  CustomAttributeInput,
  CustomContextItemDeletion,
  CustomContextItemKind,
  CustomContextItemRelationInput,
  UpdateCustomContextItemInput,
} from './resources/context/custom-items.js'
export type { ScopesResource } from './resources/scopes.js'
export type { ScopeConversationsResource } from './resources/scopes/conversations.js'
export type { ModusResource } from './resources/modus/modus.js'
export type { ModusConversationsResource } from './resources/modus/conversations.js'
export type { WorkflowsResource } from './resources/workflows.js'
export type { WorkflowRunsResource } from './resources/workflows/runs.js'
export type { AgentWorkflowActionsResource } from './resources/workflows/workflow-actions.js'
export type { ContextResource } from './resources/context/context.js'
export type { ContextItemsResource } from './resources/context/items.js'
export type { CustomContextItemsResource } from './resources/context/custom-items.js'
export type { ConnectionsResource } from './resources/connections.js'
export type { SuggestionsResource } from './resources/suggestions.js'
export type { IngestedDataResource } from './resources/ingested-data.js'

import { ModusClientBase } from './_client-base.js'
import { WorkflowsResource } from './resources/workflows.js'
import { ConnectionsResource } from './resources/connections.js'
import { ContextResource } from './resources/context/context.js'
import { IngestedDataResource } from './resources/ingested-data.js'
import { ModusResource } from './resources/modus/modus.js'
import { ScopesResource } from './resources/scopes.js'
import { SuggestionsResource } from './resources/suggestions.js'

/**
 * Read / invoke client for Modus scopes, workflows, connections, and more.
 *
 * Call path: `const client = new Modus(...)` then `client.scopes`, `client.context`, …
 *
 * @param options - Client configuration (`apiKey`, `baseUrl`, `timeoutMs`, `maxRetries`).
 */
export class Modus extends ModusClientBase {
  readonly scopes: ScopesResource
  readonly modus: ModusResource
  readonly workflows: WorkflowsResource
  readonly context: ContextResource
  readonly connections: ConnectionsResource
  readonly suggestions: SuggestionsResource
  readonly ingestedData: IngestedDataResource

  constructor(options: import('./_config.js').ModusOptions = {}) {
    super(options)
    this.scopes = new ScopesResource(this.http, this.config)
    this.modus = new ModusResource(this.http, this.config)
    this.workflows = new WorkflowsResource(this.http, this.config)
    this.context = new ContextResource(this.http, this.config)
    this.connections = new ConnectionsResource(this.http, this.config)
    this.suggestions = new SuggestionsResource(this.http, this.config)
    this.ingestedData = new IngestedDataResource(this.http, this.config)
  }
}
