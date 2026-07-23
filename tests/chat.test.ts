import { describe, expect, it, vi } from 'vitest'
import { Modus } from '../src/index.js'
import { ModusError } from '../src/_exceptions.js'
import { InternalServerError } from '../src/_exceptions.js'

const TEST_KEY = 'modus_test_key_chat'
const BASE = 'https://api.getmodus.com'
const AGENT = 'https://agent.getmodus.com'
const MODEL = 'claude-sonnet-5' as const

describe('scopes.chat', () => {
  it('posts buffered chat on new thread', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: 'Hello back',
          threadId: 'thread-abc',
          runId: 'run-xyz',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const result = await client.scopes.chat(42, 'Hello', { model: MODEL })
    expect(result.content).toBe('Hello back')
    expect(result.threadId).toBe('thread-abc')
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(String(url)).toBe(`${BASE}/api/v1/scopes/42/chat`)
    expect(JSON.parse(String(init?.body))).toEqual({ message: 'Hello', model: MODEL })
  })

  it('blank threadId uses new chat path', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: 'ok', threadId: 't1', runId: 'r1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await client.scopes.chat(42, 'Hi', { model: MODEL, threadId: '' })
    expect(String(fetch.mock.calls[0]?.[0])).not.toContain('/conversations/')
  })

  it('continues thread on conversation path', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ content: 'Follow-up', threadId: 'thread-abc', runId: 'run-2' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const result = await client.scopes.chat(42, 'And then?', {
      model: MODEL,
      threadId: 'thread-abc',
    })
    expect(result.content).toBe('Follow-up')
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/conversations/thread-abc/chat')
  })

  it('rejects invalid model', async () => {
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0 })
    await expect(
      client.scopes.chat(42, 'Hi', { model: 'not-a-real-model' as typeof MODEL }),
    ).rejects.toThrow(/Unsupported model/)
  })
})

describe('scopes.chatStream', () => {
  it('streams tokens and builds final result via agent-host runs path', async () => {
    async function* fakeStream() {
      yield 'data: {"type":"token","content":"Hi"}'
      yield 'data: {"type":"token","content":" there"}'
      yield 'data: {"type":"done","runId":"run-s1","threadId":"thread-s1"}'
    }
    const client = new Modus({
      apiKey: TEST_KEY,
      baseUrl: BASE,
      agentHost: AGENT,
      maxRetries: 0,
    })
    const streamPost = vi.spyOn(client['http'], 'streamPost').mockImplementation(() => fakeStream())

    const stream = client.scopes.chatStream(42, 'Stream me', { model: MODEL })
    const chunks: string[] = []
    for await (const chunk of stream.textStream()) chunks.push(chunk)
    const final = stream.getFinalResult()

    expect(chunks).toEqual(['Hi', ' there'])
    expect(final.content).toBe('Hi there')
    expect(final.threadId).toBe('thread-s1')
    expect(final.runId).toBe('run-s1')
    expect(streamPost.mock.calls[0]?.[0]).toBe('/agent/v1/scopes/42/runs')
    expect(streamPost.mock.calls[0]?.[1]).toMatchObject({
      message: 'Stream me',
      config: { model: MODEL },
    })
    expect(typeof (streamPost.mock.calls[0]?.[1] as { sessionId: string }).sessionId).toBe(
      'string',
    )
    expect(streamPost.mock.calls[0]?.[2]).toMatchObject({ baseUrl: AGENT })
  })

  it('reuses threadId as sessionId', async () => {
    async function* fakeStream() {
      yield 'data: {"type":"done","runId":"run-s1","threadId":"thread-abc"}'
    }
    const client = new Modus({
      apiKey: TEST_KEY,
      baseUrl: BASE,
      agentHost: AGENT,
      maxRetries: 0,
    })
    const streamPost = vi.spyOn(client['http'], 'streamPost').mockImplementation(() => fakeStream())
    const stream = client.scopes.chatStream(42, 'Hi', {
      model: MODEL,
      threadId: 'thread-abc',
    })
    for await (const _ of stream.textStream()) {
      // consume
    }
    expect(streamPost.mock.calls[0]?.[1]).toMatchObject({ sessionId: 'thread-abc' })
  })

  it('modus.chatStream posts to /agent/v1/modus/runs', async () => {
    async function* fakeStream() {
      yield 'data: {"type":"done","runId":"r1","threadId":"t1"}'
    }
    const client = new Modus({
      apiKey: TEST_KEY,
      baseUrl: BASE,
      agentHost: AGENT,
      maxRetries: 0,
    })
    const streamPost = vi.spyOn(client['http'], 'streamPost').mockImplementation(() => fakeStream())
    const stream = client.modus.chatStream('Hello', { model: MODEL })
    for await (const _ of stream.textStream()) {
      // consume
    }
    expect(streamPost.mock.calls[0]?.[0]).toBe('/agent/v1/modus/runs')
    expect(streamPost.mock.calls[0]?.[2]).toMatchObject({ baseUrl: AGENT })
  })

  it('opts event streams into reset support and replaces failed content', async () => {
    async function* fakeStream() {
      yield 'data: {"type":"token","content":"failed"}'
      yield 'data: {"type":"assistant_content_reset","content":"kept ","attempt":2,"reason":"provider_stream_failed"}'
      yield 'data: {"type":"token","content":"replacement"}'
      yield 'data: {"type":"done","runId":"run-s1","threadId":"thread-s1"}'
    }
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0 })
    const streamPost = vi
      .spyOn(client['http'], 'streamPost')
      .mockImplementation(() => fakeStream())

    const stream = client.scopes.chatStream(42, 'Stream me', { model: MODEL })
    const events = []
    for await (const event of stream.eventStream()) events.push(event)

    expect(events.map((event) => event.type)).toEqual([
      'token',
      'assistant_content_reset',
      'token',
      'done',
    ])
    expect(stream.getFinalResult().content).toBe('kept replacement')
    expect(streamPost.mock.calls[0]?.[1]).toMatchObject({
      streamProtocolVersion: 2,
    })
  })

  it('keeps string-only text streams on the append-only protocol', async () => {
    async function* fakeStream() {
      yield 'data: {"type":"done","runId":"run-s1","threadId":"thread-s1"}'
    }
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0 })
    const streamPost = vi
      .spyOn(client['http'], 'streamPost')
      .mockImplementation(() => fakeStream())
    const stream = client.scopes.chatStream(42, 'Stream me', { model: MODEL })
    for await (const _chunk of stream.textStream()) {
      // consume
    }
    expect(streamPost.mock.calls[0]?.[1]).not.toHaveProperty(
      'streamProtocolVersion',
    )
  })

  it('raises on error events', async () => {
    async function* fakeStream() {
      yield 'data: {"type":"error","message":"Model unavailable"}'
    }
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0 })
    vi.spyOn(client['http'], 'streamPost').mockImplementation(() => fakeStream())

    const stream = client.scopes.chatStream(42, 'x', { model: MODEL })
    await expect(async () => {
      for await (const _chunk of stream.textStream()) {
        // consume
      }
    }).rejects.toBeInstanceOf(ModusError)
  })

  it('raises on HTTP errors before streaming', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Upstream unavailable' }), { status: 502 }),
    )
    const client = new Modus({
      apiKey: TEST_KEY,
      baseUrl: BASE,
      agentHost: AGENT,
      maxRetries: 0,
      fetch,
    })
    const stream = client.scopes.chatStream(42, 'Hi', { model: MODEL })
    await expect(async () => {
      for await (const _chunk of stream.textStream()) {
        // consume
      }
    }).rejects.toBeInstanceOf(InternalServerError)
    expect(String(fetch.mock.calls[0]?.[0])).toBe(`${AGENT}/agent/v1/scopes/42/runs`)
  })
})

describe('modus.chat', () => {
  it('posts to modus chat endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: 'ok', threadId: 't1', runId: 'r1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await client.modus.chat('Hello modus', { model: MODEL })
    expect(String(fetch.mock.calls[0]?.[0])).toBe(`${BASE}/api/v1/modus/chat`)
  })
})
