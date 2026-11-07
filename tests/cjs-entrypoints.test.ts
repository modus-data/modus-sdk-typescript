import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

// The built CommonJS entrypoints (`test` depends on `build`). Each used to bundle its own copy of
// the error classes, so an error from `@getmodus/sdk/management` failed `instanceof ModusError`.
const require = createRequire(import.meta.url)
const root = require('../dist/index.cjs') as typeof import('../src/index.js')
const management = require('../dist/management/index.cjs') as typeof import('../src/management/index.js')

describe('CommonJS entrypoints', () => {
  it('throw the error classes the root entrypoint exports', async () => {
    const mgmt = new management.ModusManagement({ apiKey: 'modus_pat_test', maxRetries: 0 })

    const error: unknown = await mgmt.scopes.get('').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(root.ValidationError)
    expect(error).toBeInstanceOf(root.ModusError)
  })
})
