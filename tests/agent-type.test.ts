import { describe, expect, it } from 'vitest'
import { AgentType } from '../src/index.js'

describe('AgentType', () => {
  it('exposes runtime values', () => {
    expect(AgentType.task).toBe('task')
    expect(AgentType.workflow).toBe('workflow')
  })
})
