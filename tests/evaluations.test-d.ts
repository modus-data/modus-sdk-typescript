import { describe, expectTypeOf, it } from 'vitest'
import type {
  EvaluationConfig,
  EvaluationRun,
  EvaluationRunWithResults,
} from '../src/management/types/evaluations.js'

describe('evaluation run types', () => {
  it('types result fields as their nullable scalars', () => {
    type Result = EvaluationRunWithResults['results'][number]
    expectTypeOf<Result['score']>().toEqualTypeOf<number | null | undefined>()
    expectTypeOf<Result['passed']>().toEqualTypeOf<boolean | null | undefined>()
    expectTypeOf<Result['actualOutput']>().toEqualTypeOf<string | null | undefined>()
  })

  it('types run timestamps and score as their nullable scalars', () => {
    expectTypeOf<EvaluationRun['finishedAt']>().toEqualTypeOf<string | null | undefined>()
    expectTypeOf<EvaluationRun['avgScore']>().toEqualTypeOf<number | null | undefined>()
  })

  it('types cadence frequency as nullable, as the API returns it', () => {
    type Cadence = NonNullable<EvaluationConfig['cadence']>
    expectTypeOf<null>().toExtend<Cadence['frequency']>()
  })
})
