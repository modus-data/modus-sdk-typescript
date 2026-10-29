import { describe, expectTypeOf, it } from 'vitest'
import type {
  AgentRunCreateRequest,
  ModusRunCreateRequest,
  ResumeRunRequest,
  SkillRunCreateRequest,
} from '../src/types/agent-runs.js'

describe('run create bodies', () => {
  it('accept a body without sessionId, as the documented examples send', () => {
    const body = { message: 'Hi', config: { model: 'claude-sonnet-5' } }
    expectTypeOf(body).toExtend<AgentRunCreateRequest>()
    expectTypeOf(body).toExtend<SkillRunCreateRequest>()
    expectTypeOf(body).toExtend<ModusRunCreateRequest>()
  })

  it('still require sessionId to resume a conversation', () => {
    expectTypeOf<ResumeRunRequest['sessionId']>().toEqualTypeOf<string>()
  })
})
