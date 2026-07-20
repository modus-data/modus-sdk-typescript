import { describe, expect, it, vi } from 'vitest'
import { ModusManagement } from '../src/management/index.js'

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
  })

  it('deploy returns scope from deploy response', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          skill: { id: 42, name: 'X', status: 'active' },
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
})
