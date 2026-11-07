// Every request carries a W3C `traceparent`, so one id names a call on both sides: the
// customer quotes `error.traceId`, and Modus finds the server work that call caused.
import { describe, expect, it, vi } from 'vitest'
import { createModusConfig } from '../src/_config.js'
import { APIConnectionError, ModusError, NotFoundError } from '../src/_exceptions.js'
import { HttpClient } from '../src/_http.js'
import { ModusManagement } from '../src/management/index.js'

const KEY = 'modus_test_key_trace'
const SCOPE = { id: 7, name: 'trace', slug: 'trace', status: 'draft' }
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-00$/

type Sent = Record<string, string>

function respond(...responses: Response[]) {
  const fetch = vi.fn()
  for (const response of responses) fetch.mockResolvedValueOnce(response)
  const sent = (): Sent[] => fetch.mock.calls.map(([, init]) => (init as { headers: Sent }).headers)
  return { fetch: fetch as unknown as typeof globalThis.fetch, sent }
}

const ok = () => new Response(JSON.stringify(SCOPE), { status: 200 })
const unavailable = () => new Response('{"message":"Service Unavailable"}', { status: 503 })

function traceIdOf(headers: Sent): string {
  const match = TRACEPARENT.exec(headers.traceparent ?? '')
  expect(match, `traceparent ${headers.traceparent}`).not.toBeNull()
  expect(match![1]).not.toBe('0'.repeat(32))
  expect(match![2]).not.toBe('0'.repeat(16))
  return match![1]!
}

describe('traceparent', () => {
  it('is well-formed and new for every call', async () => {
    const { fetch, sent } = respond(ok(), ok())
    const mgmt = new ModusManagement({ apiKey: KEY, baseUrl: 'http://modus.test', fetch })

    await mgmt.scopes.get(7)
    await mgmt.scopes.get(7)

    const [first, second] = sent().map(traceIdOf)
    expect(first).not.toBe(second)
  })

  it('keeps one trace across the retries of one call, numbering each re-send', async () => {
    const { fetch, sent } = respond(unavailable(), unavailable(), ok())
    const mgmt = new ModusManagement({ apiKey: KEY, baseUrl: 'http://modus.test', maxRetries: 2, fetch })

    await mgmt.scopes.get(7)

    const attempts = sent()
    expect(attempts).toHaveLength(3)
    expect(new Set(attempts.map(traceIdOf)).size).toBe(1)
    expect(new Set(attempts.map((h) => h.traceparent)).size).toBe(3)
    expect(attempts.map((h) => h['X-Modus-Retry-Attempt'])).toEqual([undefined, '1', '2'])
  })

  it("keeps a caller's own traceparent from defaultHeaders", async () => {
    const own = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    const { fetch, sent } = respond(ok())
    const mgmt = new ModusManagement({
      apiKey: KEY,
      baseUrl: 'http://modus.test',
      defaultHeaders: { traceparent: own },
      fetch,
    })

    await mgmt.scopes.get(7)

    expect(sent()[0]).toMatchObject({ traceparent: own })
    expect(sent()[0]).not.toHaveProperty('Traceparent')
  })

  it('is sent on a streaming request', async () => {
    const { fetch, sent } = respond(
      new Response('data: {}\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    )
    const http = new HttpClient(createModusConfig({ apiKey: KEY, maxRetries: 0, fetch }))

    for await (const _ of http.streamPost('/agent/v1/modus/runs', {})) {
      // drain
    }

    traceIdOf(sent()[0]!)
  })
})

describe('error.traceId', () => {
  it('names the trace of the call that failed', async () => {
    const { fetch, sent } = respond(new Response('{"error":{"code":"NOT_FOUND","message":"no"}}', { status: 404 }))
    const mgmt = new ModusManagement({ apiKey: KEY, baseUrl: 'http://modus.test', maxRetries: 0, fetch })

    const error = await mgmt.scopes.get(7).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NotFoundError)
    expect((error as ModusError).traceId).toBe(traceIdOf(sent()[0]!))
  })

  it('names the trace of the last attempt when the retries ran out', async () => {
    const { fetch, sent } = respond(unavailable(), unavailable())
    const mgmt = new ModusManagement({ apiKey: KEY, baseUrl: 'http://modus.test', maxRetries: 1, fetch })

    const error = (await mgmt.scopes.get(7).catch((e: unknown) => e)) as ModusError

    expect(error.statusCode).toBe(503)
    expect(error.traceId).toBe(traceIdOf(sent()[1]!))
  })

  it('is set on a connection error', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    const http = new HttpClient(createModusConfig({ apiKey: KEY, maxRetries: 0, fetch }))

    const error = await http.get('/api/v1/scopes').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(APIConnectionError)
    const sent = (fetch.mock.calls[0]![1] as { headers: Sent }).headers
    expect((error as APIConnectionError).traceId).toBe(traceIdOf(sent))
  })
})
