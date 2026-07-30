import { describe, expect, it, vi } from 'vitest'
import { ModusManagement } from '../src/management/index.js'

const TEST_KEY = 'modus_test_key_mgmt'
const BASE = 'https://api.getmodus.com'

describe('ModusManagement.usage', () => {
  it('list forwards repeated user_email query params', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          rollup: 'day',
          group_by: 'all',
          buckets: [],
          totals: { call_count: 0, input_tokens: 0, output_tokens: 0, credits: 0 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.usage.list({
      since: '2026-01-01T00:00:00.000Z',
      until: '2026-01-02T00:00:00.000Z',
      rollup: 'day',
      userEmail: ['jane@acme.com', 'john@acme.com'],
    })
    const url = String(fetch.mock.calls[0]?.[0])
    const params = new URL(url).searchParams.getAll('user_email')
    expect(params).toEqual(['jane@acme.com', 'john@acme.com'])
  })

  it('listUsers returns distinct acting-user emails for the window', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ users: [{ email: 'jane@acme.com' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const report = await mgmt.usage.listUsers({
      since: '2026-01-01T00:00:00.000Z',
      until: '2026-01-02T00:00:00.000Z',
    })
    expect(report.users).toEqual([{ email: 'jane@acme.com' }])
    const [url] = fetch.mock.calls[0] ?? []
    expect(String(url)).toContain('/api/v1/usage/users')
  })
})
