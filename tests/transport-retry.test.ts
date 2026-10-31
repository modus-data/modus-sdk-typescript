// The retry rule and response parsing, over a real local HTTP server.
// Timers stay real: undici arms its own socket timers, so faking or shortening
// setTimeout here fires them on torn-down connections. One retry (maxRetries: 1)
// sleeps 0 s, and the Retry-After cases wait a real second.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { APIConnectionError, ModusError, RateLimitError } from '../src/_exceptions.js'
import { ModusManagement } from '../src/management/index.js'

const KEY = 'modus_test_key_transport'
const SCOPE = { id: 7, name: 'retry', slug: 'retry', status: 'draft' }

type Handler = (req: IncomingMessage, res: ServerResponse, n: number) => void
let close: (() => Promise<void>) | undefined
afterEach(async () => {
  await close?.()
  close = undefined
})

async function serve(handler: Handler): Promise<{ base: string; hits: string[] }> {
  const hits: string[] = []
  const server = createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      hits.push(`${req.method} ${req.url}`)
      handler(req, res, hits.length)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  close = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections()
      server.close(() => resolve())
    })
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, hits }
}

/** A port nothing listens on: the connection is refused before any byte is sent. */
async function refusedBase(): Promise<string> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return `http://127.0.0.1:${port}`
}

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json', ...headers }).end(JSON.stringify(body))
}

function mgmt(baseUrl: string, fetchImpl: typeof fetch = fetch): ModusManagement {
  return new ModusManagement({ apiKey: KEY, baseUrl, maxRetries: 1, fetch: fetchImpl })
}

describe('POST is not re-sent once it may have reached the server', () => {
  it('socket dropped after the server read the POST: one request, not retryable', async () => {
    const { base, hits } = await serve((req) => req.socket.destroy())
    const error = await mgmt(base).scopes.create({ name: 'retry' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(APIConnectionError)
    expect((error as APIConnectionError).retryable).toBe(false)
    expect(hits).toEqual(['POST /api/v1/scopes'])
  })

  it('502 from the gateway: one request', async () => {
    const { base, hits } = await serve((_req, res) => json(res, 502, { message: 'Bad Gateway' }))
    await mgmt(base).scopes.create({ name: 'retry' }).catch(() => undefined)
    expect(hits).toEqual(['POST /api/v1/scopes'])
  })

  it('429: retried, the rate limiter rejected it before any work', async () => {
    const { base, hits } = await serve((_req, res, n) =>
      n === 1 ? json(res, 429, { message: 'slow down' }, { 'retry-after': '0' }) : json(res, 201, SCOPE),
    )
    await expect(mgmt(base).scopes.create({ name: 'retry' })).resolves.toMatchObject({ id: 7 })
    expect(hits).toHaveLength(2)
  })

  it('connection refused: retried, nothing was sent', async () => {
    const base = await refusedBase()
    let attempts = 0
    const counting: typeof fetch = (input, init) => {
      attempts++
      return fetch(input, init)
    }
    const error = await mgmt(base, counting).scopes.create({ name: 'retry' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(APIConnectionError)
    expect((error as APIConnectionError).retryable).toBe(true)
    expect(attempts).toBe(2)
  })

  it('a POST flagged idempotent in sdk-surface.json is retried on 502', async () => {
    const { base, hits } = await serve((_req, res, n) =>
      n === 1 ? json(res, 502, { message: 'Bad Gateway' }) : json(res, 200, { memories: [] }),
    )
    await expect(mgmt(base).scopes.memories(7).search({ query: 'x' })).resolves.toEqual({ memories: [] })
    expect(hits).toEqual(['POST /api/v1/scopes/7/memories/search', 'POST /api/v1/scopes/7/memories/search'])
  })
})

describe('GET is retried on transient failures', () => {
  it.each([
    ['502', (res: ServerResponse) => json(res, 502, { message: 'Bad Gateway' })],
    ['408', (res: ServerResponse) => json(res, 408, { message: 'Request Timeout' })],
    ['a dropped socket', (res: ServerResponse) => res.socket?.destroy()],
  ])('%s', async (_label, fail) => {
    const { base, hits } = await serve((_req, res, n) => (n === 1 ? fail(res) : json(res, 200, SCOPE)))
    await expect(mgmt(base).scopes.get(7)).resolves.toMatchObject({ id: 7 })
    expect(hits).toHaveLength(2)
  })

  it('501 is not retried', async () => {
    const { base, hits } = await serve((_req, res) => json(res, 501, { message: 'Not Implemented' }))
    await mgmt(base).scopes.get(7).catch(() => undefined)
    expect(hits).toHaveLength(1)
  })
})

describe('Retry-After', () => {
  it('over 60 s: raises RateLimitError at once instead of sleeping', async () => {
    const { base, hits } = await serve((_req, res) => json(res, 429, { message: 'slow down' }, { 'retry-after': '86400' }))
    const started = Date.now()
    const error = await mgmt(base).scopes.get(7).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RateLimitError)
    expect((error as RateLimitError).retryAfter).toBe(86400)
    expect(hits).toHaveLength(1)
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('up to 60 s: sleeps that long before the retry', async () => {
    const { base } = await serve((_req, res, n) =>
      n === 1 ? json(res, 429, { message: 'slow down' }, { 'retry-after': '1' }) : json(res, 200, SCOPE),
    )
    const started = Date.now()
    await mgmt(base).scopes.get(7)
    expect(Date.now() - started).toBeGreaterThanOrEqual(950)
  })

  it('HTTP-date form', async () => {
    const when = new Date(Date.now() + 5000).toUTCString()
    const { base } = await serve((_req, res) => json(res, 429, { message: 'slow down' }, { 'retry-after': when }))
    const once = new ModusManagement({ apiKey: KEY, baseUrl: base, maxRetries: 0 })
    const error = (await once.scopes.get(7).catch((e: unknown) => e)) as RateLimitError
    expect(error.retryAfter).toBeGreaterThanOrEqual(4)
    expect(error.retryAfter).toBeLessThanOrEqual(5)
  })

  it('retry-after-ms wins over retry-after', async () => {
    const { base } = await serve((_req, res, n) =>
      n === 1
        ? json(res, 429, { message: 'slow down' }, { 'retry-after-ms': '200', 'retry-after': '30' })
        : json(res, 200, SCOPE),
    )
    const once = new ModusManagement({ apiKey: KEY, baseUrl: base, maxRetries: 0 })
    const error = (await once.scopes.get(7).catch((e: unknown) => e)) as RateLimitError
    expect(error.retryAfter).toBe(1)
  })
})

describe('a 2xx body that is not JSON', () => {
  it('raises a non-retryable ModusError with a preview, after one request', async () => {
    const { base, hits } = await serve((_req, res) =>
      res.writeHead(200, { 'content-type': 'text/html' }).end('<html>Service Unavailable</html>'),
    )
    const error = await mgmt(base).scopes.get(7).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ModusError)
    expect(error).not.toBeInstanceOf(APIConnectionError)
    expect((error as ModusError).statusCode).toBe(200)
    expect((error as ModusError).message).toBe(
      'Invalid JSON in HTTP 200 response (content-type "text/html"): <html>Service Unavailable</html>',
    )
    expect(hits).toHaveLength(1)
  })
})
