import { describe, expect, it, vi } from 'vitest'
import { ConflictError } from '../src/_exceptions.js'
import { ModusManagement } from '../src/management/index.js'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TEST_KEY = 'modus_test_key_mgmt'
const BASE = 'https://api.getmodus.com'

describe('ModusManagement.scopes', () => {
  it('create posts scope body', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 99, name: 'Analyst', status: 'draft' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const skill = await mgmt.scopes.create({
      name: 'Analyst',
      model: 'claude-sonnet-5',
      instructions: ['Answer data questions'],
      guardrails: ['no-pii'],
    })
    expect(skill.id).toBe(99)
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(String(url)).toBe(`${BASE}/api/v1/scopes`)
    expect(init?.method).toBe('POST')
    const body = JSON.parse(String(init?.body))
    expect(body.name).toBe('Analyst')
    expect(body.accessConfig.guardrails).toEqual(['no-pii'])
    expect(body).not.toHaveProperty('includeOwnLearnings')
  })

  it('create sends includeOwnLearnings when the caller opts out', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 99, name: 'Analyst', status: 'draft' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.scopes.create({ name: 'Analyst', includeOwnLearnings: false })
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))
    expect(body.includeOwnLearnings).toBe(false)
  })

  it('deploy returns scope from deploy response', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          scope: { id: 42, name: 'X', status: 'active' },
          deployedAt: '2026-01-01T00:00:00.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const skill = await mgmt.scopes.deploy(42)
    expect(skill.status).toBe('active')
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/scopes/42/deploy')
  })

  it('update resends connectionSet from get as connection_id and path', async () => {
    const row = { connection_id: '11111111-1111-4111-8111-111111111111', path: [] as string[] }
    const scopeBody = { id: 10, variation: { connectionSet: [row] } }
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(scopeBody))
      .mockResolvedValueOnce(json(scopeBody))
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const scope = await mgmt.scopes.get(10)
    expect(scope.variation?.connectionSet.length).toBeGreaterThan(0)
    await mgmt.scopes.update(10, { connectionSet: scope.variation?.connectionSet })
    const body = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))
    expect(body.connectionSet).toEqual([{ connection_id: row.connection_id, path: [] }])
  })

  it('delete calls DELETE', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.scopes.delete(42)
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('DELETE')
  })
})

describe('ModusManagement.scopes.memories', () => {
  it('search posts query body', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ memories: [], nextPageToken: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.scopes.memories(42).search({ query: 'user preferences' })
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/scopes/42/memories/search')
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      query: 'user preferences',
    })
  })

  it('list rejects a blank scope id before any request', async () => {
    const fetch = vi.fn()
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await expect(mgmt.scopes.memories('').list()).rejects.toThrow(
      'scope_id must be a non-empty string or int',
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('update resolves to undefined: the server answers 204 with no body', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const result = await mgmt.scopes.memories(42).update('mem_1', { memory: 'x' })
    expect(result).toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('ModusManagement.scopes.interfaces', () => {
  const IFACE_ID = '00000000-0000-4000-a000-000000000500'
  const row = {
    id: IFACE_ID, scopeId: 42, type: 'slack', name: 'Slack', config: {},
    createdAt: '2026-09-30T00:00:00Z', updatedAt: '2026-09-30T00:00:00Z',
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('list unwraps { interfaces }', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ interfaces: [row] }))
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const rows = await mgmt.scopes.interfaces(42).list()
    expect(rows[0]?.id).toBe(IFACE_ID)
    expect(String(fetch.mock.calls[0]?.[0])).toBe(`${BASE}/api/v1/scopes/42/interfaces`)
  })

  it('create posts the body; update sends updateMask; delete calls DELETE', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(row, 201))
      .mockResolvedValueOnce(json(row))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.scopes.interfaces(42).create({ type: 'slack', config: { accessMode: 'all' } })
    await mgmt.scopes.interfaces(42).update(IFACE_ID, { name: 'Support' }, 'name')
    await mgmt.scopes.interfaces(42).delete(IFACE_ID)
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({ type: 'slack', config: { accessMode: 'all' } })
    expect(String(fetch.mock.calls[1]?.[0])).toContain(`/api/v1/scopes/42/interfaces/${IFACE_ID}?updateMask=name`)
    expect(fetch.mock.calls[2]?.[1]?.method).toBe('DELETE')
  })
})

describe('ModusManagement.scopes.evaluations cases', () => {
  const stored = { id: 'generated', task: 't', expectedOutput: 'o' }

  it('addCase without an id sends a generated id', async () => {
    const fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const sent = JSON.parse(String(init?.body)) as { id?: string }
      return new Response(JSON.stringify({ ...stored, id: sent.id }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const added = await mgmt.scopes.evaluations(42).addCase({ task: 't', expectedOutput: 'o' })
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)) as { id: string; task: string; expectedOutput: string }
    expect(body.id).toMatch(UUID_V4)
    expect(body.task).toBe('t')
    expect(body.expectedOutput).toBe('o')
    expect(added.id).toBe(body.id)
  })

  it('a retried add sends the same body and surfaces 409', async () => {
    const bodies: { id: string; task: string; expectedOutput: string }[] = []
    const fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)))
      if (bodies.length === 1) {
        return new Response(JSON.stringify({ error: { message: 'slow down' } }), {
          status: 429,
          headers: { 'retry-after': '0' },
        })
      }
      return new Response(
        JSON.stringify({ error: { message: 'An evaluation case with this id already exists.' } }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 1, fetch })
    await expect(
      mgmt.scopes.evaluations(42).addCase({ task: 't', expectedOutput: 'o' }),
    ).rejects.toBeInstanceOf(ConflictError)
    expect(bodies).toHaveLength(2)
    expect(bodies[0]?.id).toMatch(UUID_V4)
    expect(bodies[1]).toEqual(bodies[0])
  })
})
