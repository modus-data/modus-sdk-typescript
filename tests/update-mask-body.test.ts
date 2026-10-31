import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { ModusManagement, type UpdateScopeOptions } from '../src/management/index.js'

const BASE = 'https://api.getmodus.com'
const UID = '7a3f9d2c-1111-4000-a000-000000000abc'

function client() {
  const fetch = vi.fn().mockImplementation(async () =>
    new Response(JSON.stringify({ id: 10, uid: UID }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  return { fetch, mgmt: new ModusManagement({ apiKey: 'modus_test_key_mask', baseUrl: BASE, maxRetries: 0, fetch }) }
}

function patchBody(fetch: ReturnType<typeof vi.fn>): unknown {
  const call = fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')
  return JSON.parse(String(call?.[1]?.body))
}

/**
 * The server writes only fields that are both masked and present in the body, so a masked field
 * left unset must go out as `null` to be cleared. Before the fix it was dropped and nothing cleared.
 */
describe('updateMask names a field left unset → it is sent as null', () => {
  it.each([
    ['scopes', (m: ModusManagement) => m.scopes.update(10, { name: 'n', updateMask: 'name,description' }), { name: 'n', description: null }],
    ['workflows', (m: ModusManagement) => m.workflows.update(10, { name: 'n', updateMask: 'name,description' }), { name: 'n', description: null }],
    ['scope interfaces', (m: ModusManagement) => m.scopes.interfaces(10).update('i1', { name: 'n' }, 'name,config'), { name: 'n', config: null }],
    ['workflow interfaces', (m: ModusManagement) => m.workflows.interfaces(10).update('i1', { name: 'n' }, 'name,config'), { name: 'n', config: null }],
    ['context items', (m: ModusManagement) => m.context.items.update(UID, { description: 'd', updateMask: 'description,topics' }), { description: 'd', topics: null }],
  ] as const)('%s', async (_name, call, expected) => {
    const { fetch, mgmt } = client()
    await call(mgmt)
    expect(patchBody(fetch)).toEqual(expected)
  })

  it('a nested mask path never nulls its root object', async () => {
    const { fetch, mgmt } = client()
    await mgmt.scopes.update(10, { name: 'n', updateMask: 'name,accessConfig.visibility' })
    expect(patchBody(fetch)).toEqual({ name: 'n' })
  })
})

describe('scopes.update managerId', () => {
  it('is a numeric scope id, or null to detach', async () => {
    expectTypeOf<UpdateScopeOptions['managerId']>().toEqualTypeOf<number | null | undefined>()
    const { fetch, mgmt } = client()
    await mgmt.scopes.update(10, { managerId: 7 })
    expect(patchBody(fetch)).toEqual({ managerId: 7 })
    fetch.mockClear()
    await mgmt.scopes.update(10, { managerId: null })
    expect(patchBody(fetch)).toEqual({ managerId: null })
  })
})
