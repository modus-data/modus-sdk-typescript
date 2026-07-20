import { describe, expect, it, vi } from 'vitest'
import { createModusConfig } from '../src/_config.js'
import { AuthenticationError } from '../src/_exceptions.js'
import { HttpClient } from '../src/_http.js'

const TEST_KEY = 'modus_test_key_stream'

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('HttpClient.streamPost', () => {
  it('yields SSE lines without buffering the body first', async () => {
    const config = createModusConfig({
      apiKey: TEST_KEY,
      maxRetries: 0,
      fetch: vi.fn().mockResolvedValue(
        sseResponse(['data: {"chunk":1}\n', 'data: {"chunk":2}\n\n']),
      ),
    })
    const http = new HttpClient(config)
    const lines: string[] = []
    for await (const line of http.streamPost('/api/v1/skills/1/chat', { message: 'hi' })) {
      lines.push(line)
    }
    expect(lines).toEqual(['data: {"chunk":1}', 'data: {"chunk":2}'])
  })

  it('sends Accept text/event-stream (not JSON-only) on stream requests', async () => {
    const fetch = vi.fn().mockResolvedValue(sseResponse(['data: {"type":"done"}\n\n']))
    const config = createModusConfig({
      apiKey: TEST_KEY,
      maxRetries: 0,
      fetch,
    })
    const http = new HttpClient(config)
    for await (const _ of http.streamPost('/agent/v1/modus/runs', { message: 'hi' })) {
      // drain
    }
    const init = fetch.mock.calls[0]?.[1] as { headers?: Record<string, string> }
    expect(init.headers?.Accept).toBe('text/event-stream')
  })

  it('reads error body on non-2xx without attempting to stream', async () => {
    const config = createModusConfig({
      apiKey: TEST_KEY,
      maxRetries: 0,
      fetch: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Invalid token' }), { status: 401 }),
      ),
    })
    const http = new HttpClient(config)
    await expect(async () => {
      for await (const _line of http.streamPost('/api/v1/skills/1/chat')) {
        // consume
      }
    }).rejects.toBeInstanceOf(AuthenticationError)
  })
})
