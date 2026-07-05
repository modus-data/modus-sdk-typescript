/**
 * @modus/sdk — official TypeScript client for Modus.
 */

export type { components, paths, operations } from './_generated/v1.js'
export type { OperationId, OperationSpec } from './_generated/operations.js'
export { OPERATIONS } from './_generated/operations.js'

export {
  APIConnectionError,
  AuthenticationError,
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

export { ChatStream } from './_chat.js'
export { Page } from './_pagination.js'
export type {
  CancelledEvent,
  DoneEvent,
  ErrorEvent,
  RunEvent,
  StreamTimeoutEvent,
  TokenEvent,
} from './types/runs.js'
export type { ChatModel, ChatRequest, ChatResult } from './types/chat.js'
export type { ModusOptions } from './_config.js'
export type { Skill, SkillStatus, SkillVariation } from './types/skills.js'
export type { Agent, AgentType } from './types/agents.js'
export type {
  AgentRun,
  AgentRunCreateRequest,
  AgentRunListItem,
  ApprovalScope,
  CancelRunRequest,
  CreateAgentRunRequest,
  EditQueuedRunRequest,
  InterruptRunRequest,
  ModusRunCreateRequest,
  ResumeRunRequest,
  RunStatus,
  RunTimeframe,
  SkillRunCreateRequest,
  WorkflowActionRequest,
} from './types/agent-runs.js'
export type { AgentRunStream } from './resources/agents/runs.js'
export type {
  Conversation,
  ConversationKind,
  ConversationListItem,
  Message,
} from './types/conversations.js'
export { conversationSkillId } from './types/conversations.js'
export type { Connection } from './types/connections.js'
export type { VariationView } from './types/views.js'
export type {
  ContextItem,
  ContextItemLookupRow,
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

import { ModusClientBase } from './_client-base.js'
import { WorkflowsResource } from './resources/agents.js'
import { ConnectionsResource } from './resources/connections.js'
import { ContextResource } from './resources/context/context.js'
import { ModusResource } from './resources/modus/modus.js'
import { ScopesResource } from './resources/skills.js'
import { SuggestionsResource } from './resources/suggestions.js'

/** Read / invoke client for Modus scopes, workflows, connections, and more. */
export class Modus extends ModusClientBase {
  readonly scopes: ScopesResource
  readonly modus: ModusResource
  readonly workflows: WorkflowsResource
  readonly context: ContextResource
  readonly connections: ConnectionsResource
  readonly suggestions: SuggestionsResource

  constructor(options: import('./_config.js').ModusOptions = {}) {
    super(options)
    this.scopes = new ScopesResource(this.http, this.config)
    this.modus = new ModusResource(this.http, this.config)
    this.workflows = new WorkflowsResource(this.http, this.config)
    this.context = new ContextResource(this.http, this.config)
    this.connections = new ConnectionsResource(this.http, this.config)
    this.suggestions = new SuggestionsResource(this.http, this.config)
  }
}
