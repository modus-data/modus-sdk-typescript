import { describe, expect, it, vi } from 'vitest'
import { createModusConfig } from '../src/_config.js'
import { HttpClient } from '../src/_http.js'
import { ConnectionsResource } from '../src/resources/connections.js'

const TEST_KEY = 'modus_test_key_connections'

const WAREHOUSE = {
  id: '7a3f9d2c-1111-4000-a000-000000000abc',
  name: 'Production Warehouse',
  type: 'postgresql',
}
const LAKE = {
  id: '7a3f9d2c-2222-4000-a000-000000000abc',
  name: 'Staging Lake',
  type: 'postgresql',
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function resourceWith(...pages: unknown[]) {
  const config = createModusConfig({ apiKey: TEST_KEY, maxRetries: 0 })
  const fetch = vi.fn()
  for (const page of pages) fetch.mockResolvedValueOnce(jsonResponse(page))
  return { fetch, resource: new ConnectionsResource(new HttpClient({ ...config, fetch }), config) }
}

describe('ConnectionsResource.find', () => {
  it('pages until it matches, carrying the filter and the page token', async () => {
    const { fetch, resource } = resourceWith(
      { connections: [LAKE], nextPageToken: 'tok-2' },
      { connections: [WAREHOUSE], nextPageToken: '' },
    )

    const found = await resource.find({ name: '  production warehouse  ', type: 'postgresql' })

    expect(found?.id).toBe(WAREHOUSE.id)
    expect(fetch).toHaveBeenCalledTimes(2)
    const second = new URL(String(fetch.mock.calls[1]?.[0])).searchParams
    expect(second.get('type')).toBe('postgresql')
    expect(second.get('pageToken')).toBe('tok-2')
  })

  it('returns undefined when no page holds a match', async () => {
    const { fetch, resource } = resourceWith({ connections: [LAKE], nextPageToken: '' })

    expect(await resource.find({ name: 'nonexistent' })).toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
