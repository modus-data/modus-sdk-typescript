import type { components } from '../_generated/v1.js'

export type AgentRunListItem = components['schemas']['AutomationRunListItemDto']
export type AgentRun = components['schemas']['GetAutomationRunResponseDto']
export type AgentRunListPage = components['schemas']['ListAutomationRunsResponseDto']
export type AgentRunCreateRequest = components['schemas']['AgentRunDto']
export type SkillRunCreateRequest = components['schemas']['SkillRunDto']
export type ModusRunCreateRequest = components['schemas']['ModusRunDto']
export type ResumeRunRequest = components['schemas']['ResumeRunDto']
export type CreateAgentRunRequest = AgentRunCreateRequest
export type CancelRunRequest = components['schemas']['CancelRunDto']
export type InterruptRunRequest = components['schemas']['InterruptRunDto']
export type EditQueuedRunRequest = components['schemas']['EditQueuedRunDto']
export type WorkflowActionRequest = components['schemas']['WorkflowActionDto']

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
