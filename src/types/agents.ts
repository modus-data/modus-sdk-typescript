import type { components } from '../_generated/v1.js'

export type Agent = components['schemas']['AgentDto']

/** Runtime + type for agent kinds (use `AgentType.task`, not only as a type). */
export const AgentType = {
  task: 'task',
  workflow: 'workflow',
} as const

export type AgentType = (typeof AgentType)[keyof typeof AgentType]
