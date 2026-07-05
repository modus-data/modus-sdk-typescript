import { describe, expect, it, vi } from 'vitest'
import { createModusConfig } from '../src/_config.js'
import { HttpClient } from '../src/_http.js'
import { ScopesResource } from '../src/resources/skills.js'

const TEST_KEY = 'modus_test_key_resources'

describe('ScopesResource', () => {
  it('list builds page from API response', async () => {
    const config = createModusConfig({ apiKey: TEST_KEY, maxRetries: 0 })
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          // The /api/v1/scopes list response keeps the server DTO envelope
          // key `skills` (only the path/opId moved to the scopes vocab).
          skills: [{ id: 1, name: 'Analyst' }],
          nextPageToken: 'tok1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const http = new HttpClient({ ...config, fetch })
    const resource = new ScopesResource(http, config)
    const page = await resource.list({ pageSize: 10, search: 'ana' })
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.name).toBe('Analyst')
    expect(page.hasNextPage()).toBe(true)
    const url = String(fetch.mock.calls[0]?.[0])
    expect(url).toContain('/api/v1/scopes')
  })

  it('get calls scopes endpoint with id', async () => {
    const config = createModusConfig({ apiKey: TEST_KEY, maxRetries: 0 })
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 5, name: 'X' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const http = new HttpClient({ ...config, fetch })
    const resource = new ScopesResource(http, config)
    const skill = await resource.get(5, { view: 'active' })
    expect(skill.id).toBe(5)
    expect(fetch).toHaveBeenCalledOnce()
    const url = String(fetch.mock.calls[0]?.[0])
    expect(url).toContain('/api/v1/scopes/5')
    expect(url).toContain('view=active')
  })
})
