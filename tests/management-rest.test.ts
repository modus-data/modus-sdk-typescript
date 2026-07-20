import { describe, expect, it, vi } from 'vitest'
import { ModusManagement } from '../src/management/index.js'

const TEST_KEY = 'modus_test_key_mgmt'
const BASE = 'https://api.getmodus.com'

describe('ModusManagement.workflows', () => {
  it('create posts workflow body', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 7, name: 'Daily sync', type: 'task', status: 'draft' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const agent = await mgmt.workflows.create({
      name: 'Daily sync',
      type: 'task',
      guardrails: ['no-pii'],
    })
    expect(agent.id).toBe(7)
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))
    expect(body.type).toBe('task')
    expect(body.accessConfig.guardrails).toEqual(['no-pii'])
  })

  it('deploy unwraps workflow from response', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ agent: { id: 3, name: 'X', type: 'workflow', status: 'active' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const agent = await mgmt.workflows.deploy(3)
    expect(agent.status).toBe('active')
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/workflows/3/deploy')
  })
})

describe('ModusManagement.context', () => {
  it('createNote posts note body', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ contextItemId: 'note-1', kind: 'note' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const created = await mgmt.context.createNote('Title', 'Body')
    expect(created.contextItemId).toBe('note-1')
    expect(created.uid).toBe('note-1')
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/context/notes')
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      title: 'Title',
      content: 'Body',
    })
  })

  it('items.delete calls DELETE', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ uid: 'abc', deleted: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const result = await mgmt.context.items.delete('abc')
    expect(result.uid).toBe('abc')
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('DELETE')
  })
})

describe('ModusManagement.usage', () => {
  it('list passes query params', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ buckets: [], totals: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.usage.list({
      since: '2026-01-01T00:00:00Z',
      until: '2026-02-01T00:00:00Z',
      rollup: 'day',
    })
    const url = String(fetch.mock.calls[0]?.[0])
    expect(url).toContain('since=2026-01-01T00%3A00%3A00Z')
    expect(url).toContain('rollup=day')
  })
})

describe('ModusManagement.organization', () => {
  it('delete calls DELETE organization', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.organization.delete()
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/users/organization')
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('DELETE')
  })
})
