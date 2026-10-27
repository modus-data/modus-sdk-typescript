export interface TokenEvent {
  readonly type: 'token'
  content: string
  /** Set when a sub-agent produced the token; absent for the assistant's own reply. */
  subAgent?: string
}

export interface DoneEvent {
  readonly type: 'done'
  runId: string
  threadId: string
  /** The run's final answer. */
  content?: string
}

/**
 * The run stopped for a human decision: a write tool needs approval (`toolId`,
 * `toolName`, `title`, `description`, `args`) or a workflow approval node is
 * waiting (`nodeId`, `prompt`, `options`).
 */
export interface ApprovalRequiredEvent {
  readonly type: 'approval_required'
  toolId?: string
  toolName?: string
  title?: string
  description?: string
  args?: Record<string, unknown>
  nodeId?: string
  prompt?: string
  options?: ReadonlyArray<{ id: string; label: string }>
}

export interface ErrorEvent {
  readonly type: 'error'
  message: string
}

export interface CancelledEvent {
  readonly type: 'cancelled'
}

export interface StreamTimeoutEvent {
  readonly type: 'stream_timeout'
}

export interface AssistantContentResetEvent {
  readonly type: 'assistant_content_reset'
  content: string
  visibleContent?: string
  attempt: number
  reason: 'provider_stream_failed'
  /** Set when the reset belongs to a sub-agent's timeline; absent for the assistant's own reply. */
  subAgent?: Record<string, unknown>
}

export type ActiveConversationRunStatus = 'queued' | 'pending' | 'running'

export interface ActiveConversationRun {
  readonly runId: string
  readonly sessionId: string
  readonly status: ActiveConversationRunStatus
  readonly message?: string
  readonly createdAt: string
  readonly updatedAt: string
}

export type RunEvent =
  | TokenEvent
  | DoneEvent
  | ErrorEvent
  | CancelledEvent
  | StreamTimeoutEvent
  | AssistantContentResetEvent
  | ApprovalRequiredEvent
