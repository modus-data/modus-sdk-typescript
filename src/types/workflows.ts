import type { components } from '../_generated/v1.js'

/** Canonical public type for a Modus workflow (OpenAPI `WorkflowDto`). */
export type Workflow = components['schemas']['WorkflowDto']

/** Runtime + type for workflow kinds (use `WorkflowType.task`, not only as a type). */
export const WorkflowType = {
  task: 'task',
  workflow: 'workflow',
} as const

export type WorkflowType = (typeof WorkflowType)[keyof typeof WorkflowType]

/** @deprecated Use `Workflow` instead. Same shape as OpenAPI `AgentDto`. */
export type Agent = components['schemas']['AgentDto']
/** @deprecated Use `WorkflowType` instead. */
export type AgentType = WorkflowType
/** @deprecated Use `WorkflowType` instead. */
export const AgentType = WorkflowType
