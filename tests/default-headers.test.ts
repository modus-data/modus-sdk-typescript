import { describe, expect, it, vi } from 'vitest'
import { createModusConfig, type ModusOptions } from '../src/_config.js'
import { HttpClient } from '../src/_http.js'

const TEST_KEY = 'modus_test_key_headers'

const transports = {
  json: {
    response: () => new Response('{}', { status: 200 }),
    send: (http: HttpClient, headers?: Record<string, string>) =>
      http.get('/api/v1/scopes', undefined, { headers }),
  },
  sse: {
    response: () =>
      new Response('data: {}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    send: async (http: HttpClient, headers?: Record<string, string>) => {
      for await (const _ of http.streamPost('/agent/v1/modus/runs', {}, { headers })) {
        // drain
      }
    },
  },
}

describe.each(Object.entries(transports))('default headers (%s)', (_, transport) => {
  async function sentHeaders(
    options: ModusOptions = {},
    requestHeaders?: Record<string, string>,
  ): Promise<Record<string, string>> {
    const fetch = vi.fn().mockResolvedValue(transport.response())
    await transport.send(
      new HttpClient(createModusConfig({ apiKey: TEST_KEY, maxRetries: 0, fetch, ...options })),
      requestHeaders,
    )
    return (fetch.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers
  }

  it('identifies the SDK as the client', async () => {
    expect((await sentHeaders())['X-Modus-Client']).toBe('sdk')
  })

  it("lets the caller's defaultHeaders override the SDK's", async () => {
    const headers = await sentHeaders({
      defaultHeaders: { 'x-modus-client': 'cli', 'X-Extra': '1' },
    })
    expect(headers).toMatchObject({ 'x-modus-client': 'cli', 'X-Extra': '1' })
    expect(headers).not.toHaveProperty('X-Modus-Client')
  })

  it('keeps Authorization from apiKey', async () => {
    const headers = await sentHeaders({ defaultHeaders: { authorization: 'Bearer other' } })
    expect(headers).toMatchObject({ Authorization: `Bearer ${TEST_KEY}` })
    expect(headers).not.toHaveProperty('authorization')
  })

  it('keeps Authorization from apiKey over per-request headers', async () => {
    const headers = await sentHeaders({}, { Authorization: 'Bearer other' })
    expect(headers).toMatchObject({ Authorization: `Bearer ${TEST_KEY}` })
  })
})
