import { describe, expect, it, vi } from 'vitest'
import { createModusConfig } from '../src/_config.js'
import { HttpClient } from '../src/_http.js'
import { ContextItemsResource } from '../src/resources/context/items.js'
import { ModusResource } from '../src/resources/modus/modus.js'
import { ScopesResource } from '../src/resources/skills.js'

const TEST_KEY = 'modus_test_key_context'

const SAMPLE_CONTEXT_ITEM = {
  uid: '7a3f9d2c-1111-4000-a000-000000000abc',
  orgId: 'org-uuid-abc',
  contextType: 'note',
  description: 'Fiscal year',
  content: { text: 'Feb 1 – Jan 31' },
  userFeedback: 'positive',
  topics: ['finance'],
  connectionId: null,
  selectionId: null,
  dataPath: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('ContextItemsResource', () => {
  it('get URL-encodes uid path segments', async () => {
    const config = createModusConfig({ apiKey: TEST_KEY, maxRetries: 0 })
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...SAMPLE_CONTEXT_ITEM, uid: 'uid with spaces' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const http = new HttpClient({ ...config, fetch })
    const resource = new ContextItemsResource(http, config)
    await resource.get('uid with spaces')
    const url = String(fetch.mock.calls[0]?.[0])
    expect(url).toContain('uid%20with%20spaces')
  })

  it('list repeats contextTypes query param', async () => {
    const config = createModusConfig({ apiKey: TEST_KEY, maxRetries: 0 })
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ contextItems: [], nextPageToken: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const http = new HttpClient({ ...config, fetch })
    const resource = new ContextItemsResource(http, config)
    await resource.list({ contextType: 'note' })
    const url = String(fetch.mock.calls[0]?.[0])
    expect(url).toContain('contextTypes=note')
  })

  it('lookup returns undefined on 404', async () => {
    const config = createModusConfig({ apiKey: TEST_KEY, maxRetries: 0 })
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'not found' }), { status: 404 }),
    )
    const http = new HttpClient({ ...config, fetch })
    const resource = new ContextItemsResource(http, config)
    const row = await resource.lookup({
      contextType: 'note',
      dataPath: ['a'],
    })
    expect(row).toBeUndefined()
    expect(fetch).toHaveBeenCalledOnce()
  })
})

describe('getContext', () => {
  it('scopes.getContext posts compose body', async () => {
    const config = createModusConfig({ apiKey: TEST_KEY, maxRetries: 0 })
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ context: '# Context', contextItems: [], originalCount: 0, sessionId: 's1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const http = new HttpClient({ ...config, fetch })
    const resource = new ScopesResource(http, config)
    const result = await resource.getContext(42, 'What is churn?', { limit: 5 })
    expect(result.context).toBe('# Context')
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(String(url)).toContain('/api/v1/scopes/42/context')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ message: 'What is churn?', limit: 5 })
  })

  it('modus.getContext posts to modus compose endpoint', async () => {
    const config = createModusConfig({ apiKey: TEST_KEY, maxRetries: 0 })
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ context: 'summary', contextItems: [], originalCount: 0, sessionId: 's2' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const http = new HttpClient({ ...config, fetch })
    const resource = new ModusResource(http, config)
    await resource.getContext('tables for churn')
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/modus/context')
  })
})
