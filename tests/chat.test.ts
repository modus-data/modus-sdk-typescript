import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modus } from '../src/index.js'
import { InternalServerError, ModusError, ValidationError } from '../src/_exceptions.js'

const TEST_KEY = 'modus_test_key_chat'
const BASE = 'https://api.getmodus.com'
const AGENT = 'https://agent.getmodus.com'
const MODEL = 'claude-sonnet-5.5' as const

const ANSWER_FRAMES = [
  { type: 'token', content: 'Let me check. ' },
  { type: 'tool_start', tool: { toolId: 't1', toolName: 'sql' } },
  { type: 'token', content: 'chatter', subAgent: 'researcher' },
  { type: 'tool_end', tool: { toolId: 't1', toolName: 'sql', success: true } },
  { type: 'token', content: 'Revenue grew 12% QoQ.' },
  { type: 'done', runId: 'run-1', threadId: 'thread-1', content: 'Revenue grew 12% QoQ.' },
]

function sse(frames: readonly unknown[]): Response {
  const body = frames.map((frame) => `id: 1-0\ndata: ${JSON.stringify(frame)}\n\n`).join('')
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

function clientWith(...responses: Response[]) {
  const fetch = vi.fn()
  for (const response of responses) fetch.mockResolvedValueOnce(response)
  const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
  return { client, fetch }
}

function sentBody(fetch: ReturnType<typeof vi.fn>, call = 0): Record<string, unknown> {
  return JSON.parse(String((fetch.mock.calls[call]?.[1] as RequestInit).body)) as Record<string, unknown>
}

describe('chat()', () => {
  it('await chat() resolves the server final answer', async () => {
    const { client } = clientWith(sse(ANSWER_FRAMES))

    const result = await client.scopes.chat(199, 'Revenue trend?', { model: MODEL })

    expect(result).toEqual({ content: 'Revenue grew 12% QoQ.', threadId: 'thread-1', runId: 'run-1' })
  })

  it('textStream yields top-level tokens only', async () => {
    const { client } = clientWith(sse(ANSWER_FRAMES))

    const tokens: string[] = []
    for await (const token of client.scopes.chat(199, 'Revenue trend?', { model: MODEL }).textStream()) {
      tokens.push(token)
    }

    expect(tokens).toEqual(['Let me check. ', 'Revenue grew 12% QoQ.'])
  })

  it('posts to the agent host with sessionId = threadId', async () => {
    const { client, fetch } = clientWith(sse(ANSWER_FRAMES))

    await client.scopes.chat(199, 'Follow up', { model: MODEL, threadId: 'api-skill-199-abc' })

    expect(String(fetch.mock.calls[0]?.[0])).toBe(`${AGENT}/agent/v1/scopes/199/runs`)
    expect(sentBody(fetch)).toEqual({
      message: 'Follow up',
      config: { model: MODEL },
      sessionId: 'api-skill-199-abc',
      streamProtocolVersion: 2,
    })
  })

  it('modus.chat continues a buffered-era Modus thread', async () => {
    const { client, fetch } = clientWith(sse(ANSWER_FRAMES))

    await client.modus.chat('And then?', { model: MODEL, threadId: 'agent_0_abc' })

    expect(String(fetch.mock.calls[0]?.[0])).toBe(`${AGENT}/agent/v1/modus/runs`)
    expect(sentBody(fetch)).toMatchObject({ sessionId: 'agent_0_abc' })
  })

  it('surfaces approval_required as result.approval', async () => {
    const approval = {
      type: 'approval_required',
      toolId: 'tool-9',
      toolName: 'run_sql_write',
      title: 'Update 3 rows',
      description: 'UPDATE accounts …',
      args: { sql: 'UPDATE …' },
    }
    const { client } = clientWith(sse([approval, { type: 'done', runId: 'run-1', threadId: 'thread-1', content: '' }]))

    const result = await client.modus.chat('Fix the typo', { model: MODEL })

    expect(result.approval).toEqual(approval)
  })

  it('keeps only the declared, well-typed fields of a malformed approval frame', async () => {
    const malformed = {
      type: 'approval_required',
      toolId: 42,
      toolName: 'run_sql_write',
      args: ['not', 'a', 'record'],
      options: 'approve',
      nodeId: 'n1',
      internalToken: 'secret',
    }
    const { client } = clientWith(sse([malformed, { type: 'done', runId: 'run-1', threadId: 'thread-1', content: '' }]))

    const result = await client.modus.chat('Fix the typo', { model: MODEL })

    expect(result.approval).toEqual({ type: 'approval_required', toolName: 'run_sql_write', nodeId: 'n1' })
  })

  it('resume posts the decision to /agent/v1/runs/{runId}/resume', async () => {
    const { client, fetch } = clientWith(
      sse([{ type: 'approval_required', toolId: 'tool-9', toolName: 'run_sql_write' }, { type: 'done', runId: 'run-1', threadId: 'thread-1' }]),
      sse([{ type: 'token', content: 'Updated.' }, { type: 'done', runId: 'run-2', threadId: 'thread-1', content: 'Updated.' }]),
    )

    const session = client.modus.chat('Fix the typo', { model: MODEL })
    await session
    const resumed = await session.resume({ decision: 'approve' })

    expect(String(fetch.mock.calls[1]?.[0])).toBe(`${AGENT}/agent/v1/runs/run-1/resume`)
    expect(sentBody(fetch, 1)).toEqual({ sessionId: 'thread-1', decision: 'approve', streamProtocolVersion: 2 })
    expect(resumed.content).toBe('Updated.')
  })

  it('resume sends no message: the decision is the whole turn', async () => {
    const { client, fetch } = clientWith(
      sse([{ type: 'approval_required', toolId: 'tool-9' }, { type: 'done', runId: 'run-1', threadId: 'thread-1' }]),
      sse([{ type: 'done', runId: 'run-2', threadId: 'thread-1', content: 'Updated.' }]),
    )

    const session = client.modus.chat('Fix the typo', { model: MODEL })
    await session
    await session.resume({ decision: 'deny' })

    expect(sentBody(fetch, 1)).not.toHaveProperty('message')
  })

  it.each(['..', '.', ' '])('resume refuses run id %j before any request', async (runId) => {
    const { client, fetch } = clientWith(
      sse([{ type: 'approval_required', toolId: 'tool-9' }, { type: 'done', runId, threadId: 'thread-1' }]),
    )

    const session = client.modus.chat('Fix the typo', { model: MODEL })
    await session

    expect(() => session.resume({ decision: 'approve' })).toThrow(ValidationError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('a consumer that stops at done can still resume', async () => {
    const { client, fetch } = clientWith(
      sse([{ type: 'approval_required', toolId: 'tool-9' }, { type: 'done', runId: 'run-1', threadId: 'thread-1' }]),
      sse([{ type: 'done', runId: 'run-2', threadId: 'thread-1', content: 'Updated.' }]),
    )

    const chat = client.modus.chat('Fix the typo', { model: MODEL })
    for await (const event of chat.eventStream()) if (event.type === 'done') break
    const resumed = await chat.resume({ decision: 'approve' })

    expect(String(fetch.mock.calls[1]?.[0])).toBe(`${AGENT}/agent/v1/runs/run-1/resume`)
    expect(resumed.content).toBe('Updated.')
  })

  it('iterating twice sends one request', async () => {
    const { client, fetch } = clientWith(sse(ANSWER_FRAMES))

    const session = client.scopes.chat(199, 'Revenue trend?', { model: MODEL })
    const first: string[] = []
    for await (const token of session.textStream()) first.push(token)
    const second: string[] = []
    for await (const token of session.textStream()) second.push(token)

    expect(second).toEqual(first)
    expect((await session).content).toBe('Revenue grew 12% QoQ.')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  // A server that keeps the connection open after its frames: the SDK has to let go.
  function openSse(frames: readonly unknown[]): { response: Response; cancelled: () => boolean } {
    let cancelled = false
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const frame of frames) controller.enqueue(encoder.encode(`id: 1-0\ndata: ${JSON.stringify(frame)}\n\n`))
      },
      cancel() {
        cancelled = true
      },
    })
    const response = new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
    return { response, cancelled: () => cancelled }
  }

  it('a consumer that stops at done releases the connection', async () => {
    const server = openSse([{ type: 'done', runId: 'run-1', threadId: 'thread-1', content: 'Hi.' }])
    const { client } = clientWith(server.response)

    const chat = client.scopes.chat(199, 'Hi', { model: MODEL })
    for await (const event of chat.eventStream()) if (event.type === 'done') break

    expect(server.cancelled()).toBe(true)
    expect((await chat).content).toBe('Hi.')
  })

  it('close() releases a stream the consumer abandoned mid-run', async () => {
    const server = openSse([{ type: 'token', content: 'Revenue' }])
    const { client } = clientWith(server.response)

    const chat = client.scopes.chat(199, 'Hi', { model: MODEL })
    for await (const _token of chat.textStream()) break
    await chat.close()

    expect(server.cancelled()).toBe(true)
  })

  it('textStream after await replays a provider reset, not the replaced tokens', async () => {
    const { client } = clientWith(
      sse([
        { type: 'token', content: 'Draft ' },
        { type: 'token', content: 'garbled' },
        { type: 'assistant_content_reset', content: 'Draft ', attempt: 2, reason: 'provider_stream_failed' },
        { type: 'token', content: 'final.' },
        { type: 'done', runId: 'run-1', threadId: 'thread-1', content: 'Draft final.' },
      ]),
    )

    const chat = client.scopes.chat(199, 'Hi', { model: MODEL })
    await chat
    const tokens: string[] = []
    for await (const token of chat.textStream()) tokens.push(token)

    expect(tokens.join('')).toBe('Draft final.')
  })

  it('textStream ignores a sub-agent reset', async () => {
    const { client } = clientWith(
      sse([
        { type: 'token', content: 'A' },
        { type: 'assistant_content_reset', content: 'zzz', attempt: 2, reason: 'provider_stream_failed', subAgent: { name: 'researcher' } },
        { type: 'token', content: 'B' },
        { type: 'done', runId: 'run-1', threadId: 'thread-1', content: 'AB' },
      ]),
    )

    const chat = client.scopes.chat(199, 'Hi', { model: MODEL })
    await chat
    const tokens: string[] = []
    for await (const token of chat.textStream()) tokens.push(token)

    expect(tokens.join('')).toBe('AB')
  })

  it('raises on error events', async () => {
    const { client } = clientWith(sse([{ type: 'error', error: 'Model unavailable' }]))

    await expect(client.scopes.chat(199, 'x', { model: MODEL })).rejects.toThrow('Model unavailable')
  })

  it('raises on HTTP errors before streaming', async () => {
    const { client } = clientWith(new Response(JSON.stringify({ message: 'Upstream unavailable' }), { status: 502 }))

    await expect(client.scopes.chat(199, 'x', { model: MODEL })).rejects.toBeInstanceOf(InternalServerError)
  })

  it('rejects an unsupported model before sending, as a rejection like the old async chat()', async () => {
    const { client, fetch } = clientWith()

    await expect(client.scopes.chat(199, 'x', { model: 'not-a-model' as typeof MODEL })).rejects.toThrow(/Unsupported model/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('supports catch and finally like the promise chat() used to return', async () => {
    const { client } = clientWith(sse([{ type: 'error', error: 'Model unavailable' }]))
    const settled = vi.fn()

    const caught = await client.scopes
      .chat(199, 'x', { model: MODEL })
      .catch((error: Error) => error.message)
      .finally(settled)

    expect(caught).toBe('Model unavailable')
    expect(settled).toHaveBeenCalledOnce()
  })

  it('has no chatStream', () => {
    const { client } = clientWith()

    expect('chatStream' in client.scopes).toBe(false)
    expect('chatStream' in client.modus).toBe(false)
  })
})

describe('workflows.chat()', () => {
  it('posts to /agent/v1/workflows/7/runs and streams node tokens', async () => {
    const { client, fetch } = clientWith(
      sse([
        { type: 'workflow_started', runId: 'wf-1', automationId: 7 },
        { type: 'node_content', nodeId: 'n1', event: { type: 'token', content: 'Weekly ' } },
        { type: 'node_content', nodeId: 'n1', event: { type: 'token', content: 'digest' } },
        { type: 'workflow_done', runId: 'wf-1', finalOutput: 'Weekly digest' },
      ]),
    )

    const session = client.workflows.chat(7, 'Run it', { model: MODEL, threadId: 'wf-thread' })
    const tokens: string[] = []
    for await (const token of session.textStream()) tokens.push(token)
    const result = await session

    expect(String(fetch.mock.calls[0]?.[0])).toBe(`${AGENT}/agent/v1/workflows/7/runs`)
    expect(tokens).toEqual(['Weekly ', 'digest'])
    expect(result).toEqual({ content: 'Weekly digest', threadId: 'wf-thread', runId: 'wf-1' })
  })

  it.each([
    { type: 'done', runId: 'child-1', content: 'node one only' },
    { type: 'error', error: 'node timed out' },
    { type: 'cancelled', runIds: ['child-1'] },
    { type: 'stream_timeout' },
  ])('ignores a node terminal frame wrapped in node_content: $type', async (inner) => {
    // Only workflow_done / workflow_error / workflow_cancelled end a workflow session.
    const { client } = clientWith(
      sse([
        { type: 'node_content', nodeId: 'n1', event: { type: 'token', content: 'one ' } },
        { type: 'node_content', nodeId: 'n1', event: inner },
        { type: 'node_content', nodeId: 'n2', event: { type: 'token', content: 'two' } },
        { type: 'workflow_done', runId: 'wf-1', finalOutput: 'final' },
      ]),
    )

    const session = client.workflows.chat(7, 'Run it', { model: MODEL })
    const tokens: string[] = []
    for await (const token of session.textStream()) tokens.push(token)
    const result = await session

    expect(tokens).toEqual(['one ', 'two'])
    expect(result).toMatchObject({ content: 'final', runId: 'wf-1' })
  })

  it('raises on workflow_error', async () => {
    const { client } = clientWith(sse([{ type: 'workflow_error', runId: 'wf-1', error: 'Node n1 failed: quota' }]))

    await expect(client.workflows.chat(7, 'Run it', { model: MODEL })).rejects.toBeInstanceOf(ModusError)
  })
})

describe('agent host', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['the agentHost option', { agentHost: 'http://localhost:3130' }, undefined],
    ['MODUS_AGENT_HOST', {}, 'http://localhost:3130'],
  ])('a localhost baseUrl chats through %s', async (_how, extra, env) => {
    vi.stubEnv('MODUS_AGENT_HOST', env)
    const fetch = vi.fn().mockResolvedValueOnce(sse(ANSWER_FRAMES))
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: 'http://localhost:3040', maxRetries: 0, fetch, ...extra })

    await client.scopes.chat(1, 'x', { model: MODEL })

    expect(String(fetch.mock.calls[0]?.[0])).toBe('http://localhost:3130/agent/v1/scopes/1/runs')
  })

  it.each(['', '  '])('a blank MODUS_AGENT_HOST (%j) refuses to chat before any request', async (env) => {
    vi.stubEnv('MODUS_AGENT_HOST', env)
    const fetch = vi.fn()
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: 'http://localhost:3040', maxRetries: 0, fetch })

    await expect(client.scopes.chat(1, 'x', { model: MODEL })).rejects.toThrow(/agentHost/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('a localhost baseUrl without agentHost refuses to chat', async () => {
    vi.stubEnv('MODUS_AGENT_HOST', undefined)
    const fetch = vi.fn()
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: 'http://localhost:3040', maxRetries: 0, fetch })

    await expect(client.scopes.chat(1, 'x', { model: MODEL })).rejects.toThrow(/agentHost/)
    expect(fetch).not.toHaveBeenCalled()
  })
})
