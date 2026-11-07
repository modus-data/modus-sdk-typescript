import { describe, expectTypeOf, it } from 'vitest'
import type { components } from '../src/index.js'
import type { CreateCustomContextItemInput, UpdateCustomContextItemInput } from '../src/index.js'

describe('custom context item input types', () => {
  it('takes the access policy the create endpoint accepts', () => {
    expectTypeOf<CreateCustomContextItemInput['access']>().toEqualTypeOf<
      components['schemas']['AccessPolicyDto'] | undefined
    >()
  })

  it('does not offer access on update, which the endpoint does not accept', () => {
    expectTypeOf<'access' extends keyof UpdateCustomContextItemInput ? true : false>().toEqualTypeOf<false>()
  })
})
