import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { createModusConfig } from '../src/_config.js'
import { ModusError, RateLimitError } from '../src/_exceptions.js'
import { HttpClient } from '../src/_http.js'

/** Shared with the Python suite (tests/test_error_responses.py) so both SDKs map errors identically. */
interface ErrorCase {
  name: string
  status: number
  headers: Record<string, string>
  body: string
  expect: {
    class: string
    statusCode: number
    code: string | null
    message: string
    requestId: string | null
    info: Record<string, unknown> | null
    retryAfter?: number
    retry: { GET: boolean; POST: boolean }
  }
}

const CLIENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const { cases } = JSON.parse(readFileSync(join(CLIENTS_DIR, 'error-responses.json'), 'utf8')) as {
  cases: ErrorCase[]
}

async function raised(c: ErrorCase, method: 'GET' | 'POST'): Promise<ModusError> {
  const fetch = vi.fn().mockResolvedValue(new Response(c.body, { status: c.status, headers: c.headers }))
  const http = new HttpClient(createModusConfig({ apiKey: 'modus_test_key', maxRetries: 0, fetch }))
  const call = method === 'GET' ? http.get('/api/v1/scopes') : http.post('/api/v1/scopes', {})
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(ModusError)
  return error as ModusError
}

describe.each(cases)('$name', (c) => {
  it.each(['GET', 'POST'] as const)('%s raises the documented error', async (method) => {
    const error = await raised(c, method)
    expect(error.name).toBe(c.expect.class)
    expect(error.statusCode).toBe(c.expect.statusCode)
    expect(error.code ?? null).toBe(c.expect.code)
    expect(error.message).toBe(c.expect.message)
    expect(error.requestId ?? null).toBe(c.expect.requestId)
    expect(error.info ?? null).toEqual(c.expect.info)
    expect(error.body).toBe(c.body)
    if (c.expect.retryAfter !== undefined) {
      expect((error as RateLimitError).retryAfter).toBe(c.expect.retryAfter)
    }
    expect(error.retryable).toBe(c.expect.retry[method])
  })
})
