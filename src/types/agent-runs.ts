import type { components } from '../_generated/v1.js'

export type AgentRunListItem = components['schemas']['AutomationRunListItemDto']
export type AgentRun = components['schemas']['GetAutomationRunResponseDto']
export type AgentRunListPage = components['schemas']['ListAutomationRunsResponseDto']
/** A new run's body: `sessionId` is optional, because the SDK starts a new conversation when it is omitted. */
type NewRunBody<T extends { sessionId: string }> = Omit<T, 'sessionId'> & { sessionId?: string }
export type AgentRunCreateRequest = NewRunBody<components['schemas']['AgentRunDto']>
export type SkillRunCreateRequest = NewRunBody<components['schemas']['SkillRunDto']>
export type ModusRunCreateRequest = NewRunBody<components['schemas']['ModusRunDto']>
export type ResumeRunRequest = components['schemas']['ResumeRunDto']
export type CreateAgentRunRequest = AgentRunCreateRequest
export type CancelRunRequest = components['schemas']['CancelRunDto']
export type InterruptRunRequest = components['schemas']['InterruptRunDto']
export type EditQueuedRunRequest = components['schemas']['EditQueuedRunDto']
/** The turn `runs.interrupt` / `runs.editQueued` send as `nextRun`. */
export type FollowUpRunRequest = components['schemas']['FollowUpRunDto']
/** The run `runs.interrupt` / `runs.editQueued` admitted. */
export type RunAdmission = components['schemas']['RunAdmissionResponseDto']
export type WorkflowActionRequest = components['schemas']['WorkflowActionDto']
/** One `runs.events()` poll: the buffered events after the cursor, the next cursor and the run status. */
export type RunEventsPollResponse = components['schemas']['RunEventsPollResponseDto']

export type RunStatus =
  | 'running'
  | 'awaiting_human'
  | 'completed'
  | 'error'
  | 'cancelled'
  | 'all_executions'
  | (string & {})

export type RunTimeframe = 'last_hour' | 'last_day' | 'last_week' | (string & {})
export type ApprovalScope = 'mine' | 'all' | (string & {})
