/** Fields every run event carries. */
export interface RunEventBase {
  /**
   * The SSE event id. Pass it as `lastEventId` to `runs.stream(runId, { lastEventId })`
   * to resume after this event. Absent when the stream sent none.
   */
  readonly id?: string
}

export interface TokenEvent extends RunEventBase {
  readonly type: 'token'
  content: string
  /** Set when a sub-agent produced the token; absent for the assistant's own reply. */
  subAgent?: string
}

export interface DoneEvent extends RunEventBase {
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
export interface ApprovalRequiredEvent extends RunEventBase {
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

export interface ErrorEvent extends RunEventBase {
  readonly type: 'error'
  message: string
  /** The id to quote to support for this failure. */
  requestId?: string
}

export interface CancelledEvent extends RunEventBase {
  readonly type: 'cancelled'
}

export interface StreamTimeoutEvent extends RunEventBase {
  readonly type: 'stream_timeout'
}

export interface AssistantContentResetEvent extends RunEventBase {
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
