import { describe, expectTypeOf, it } from 'vitest'
import type { RunEvent } from '../src/types/runs.js'

describe('run event types', () => {
  it('lets every run event carry its SSE id', () => {
    expectTypeOf<RunEvent['id']>().toEqualTypeOf<string | undefined>()
  })
})
