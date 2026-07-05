export interface TokenEvent {
  readonly type: 'token'
  content: string
}

export interface DoneEvent {
  readonly type: 'done'
  runId: string
  threadId: string
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
