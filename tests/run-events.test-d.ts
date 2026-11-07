import { describe, expectTypeOf, it } from 'vitest'
import type { RunEventsPollResponse, WorkflowRunsResource } from '../src/index.js'
import type { RunEvent } from '../src/types/runs.js'

describe('run event types', () => {
  it('lets every run event carry its SSE id', () => {
    expectTypeOf<RunEvent['id']>().toEqualTypeOf<string | undefined>()
  })

  it('types the JSON poll response of runs.events()', () => {
    type Poll = Awaited<ReturnType<WorkflowRunsResource['events']>>
    expectTypeOf<Poll>().toEqualTypeOf<RunEventsPollResponse>()
    expectTypeOf<Poll['cursor']>().toEqualTypeOf<string>()
    expectTypeOf<Poll['done']>().toEqualTypeOf<boolean>()
    expectTypeOf<Poll['events'][number]['id']>().toEqualTypeOf<string>()
    expectTypeOf<Poll['events'][number]['type']>().toEqualTypeOf<string>()
    expectTypeOf<'succeeded'>().toExtend<Poll['status']>()
  })
})
