import { describe, expect, it, vi } from 'vitest'
import { createModusConfig } from '../src/_config.js'
import { HttpClient } from '../src/_http.js'
import { WorkflowsResource } from '../src/resources/agents.js'

const TEST_KEY = 'modus_test_key_agent_service'

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

function resource(fetch: typeof globalThis.fetch): WorkflowsResource {
  const config = createModusConfig({
    apiKey: TEST_KEY,
    maxRetries: 0,
    baseUrls: { 'agent-service': 'http://localhost:3130' },
    fetch,
  })
  return new WorkflowsResource(new HttpClient(config), config)
}

describe('agent-service resources', () => {
  it('creates a workflow run on agent-service with idempotency key', async () => {
    const fetch = vi.fn().mockResolvedValue(
      sseResponse(['data: {"type":"done","runId":"run-123","threadId":"thread-1"}\n\n']),
    )
    const workflows = resource(fetch)
    const run = workflows.runs.create(
      123,
      {
        message: 'hello',
        sessionId: 'session-1',
        organizationId: 'org_123',
      },
      { idempotencyKey: 'run-123' },
    )

    const events: unknown[] = []
    for await (const event of run.events) events.push(event)

    expect(run.runId).toBe('run-123')
    expect(events.at(-1)).toMatchObject({ type: 'done', runId: 'run-123' })
    expect(fetch).toHaveBeenCalledOnce()
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      'http://localhost:3130/agent/v1/workflows/123/runs',
    )
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ 'Idempotency-Key': 'run-123' }),
      body: JSON.stringify({
        message: 'hello',
        sessionId: 'session-1',
        organizationId: 'org_123',
        streamProtocolVersion: 2,
      }),
    })
  })

  it('createModus return is directly async-iterable', async () => {
    const fetch = vi.fn().mockResolvedValue(
      sseResponse(['data: {"type":"done","runId":"modus-1","threadId":"t1"}\n\n']),
    )
    const workflows = resource(fetch)
    const run = workflows.runs.createModus({
      message: 'hi',
      sessionId: 'session-1',
      organizationId: 'org_123',
    })
    expect(typeof run[Symbol.asyncIterator]).toBe('function')
    const events: unknown[] = []
    for await (const event of run) events.push(event)
    expect(events.at(-1)).toMatchObject({ type: 'done', runId: 'modus-1' })
  })

  it('falls back to body runId when idempotency key is blank', async () => {
    const fetch = vi.fn().mockResolvedValue(
      sseResponse(['data: {"type":"done","runId":"body-run","threadId":"thread-1"}\n\n']),
    )
    const workflows = resource(fetch)
    const run = await workflows.runs.create(
      123,
      {
        message: 'hello',
        sessionId: 'session-1',
        organizationId: 'org_123',
        runId: 'body-run',
      },
      { idempotencyKey: '   ' },
    )

    expect(run.runId).toBe('body-run')
    for await (const _event of run.events) {
      // consume stream
    }
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ 'Idempotency-Key': 'body-run' }),
    })
  })

  it('streams an existing run with Last-Event-ID', async () => {
    const fetch = vi.fn().mockResolvedValue(
      sseResponse(['data: {"type":"token","content":"hi"}\n\n']),
    )
    const workflows = resource(fetch)
    const run = workflows.runs.stream('run-123', { lastEventId: '1717000000000-0' })

    const events: unknown[] = []
    for await (const event of run.events) events.push(event)

    expect(events).toEqual([{ type: 'token', content: 'hi' }])
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      'http://localhost:3130/agent/v1/runs/run-123/stream',
    )
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({ 'Last-Event-ID': '1717000000000-0' }),
    })
  })

  it('cancels agent runs through generated operation metadata', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const workflows = resource(fetch)

    await workflows.runs.cancel('run-123')

    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      'http://localhost:3130/agent/v1/runs/run-123/cancel',
    )
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({}),
    })
  })

  it('lists active conversation runs through generated operation metadata', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        runs: [
          {
            runId: 'run-active',
            sessionId: 'agent_0_thread_1',
            status: 'running',
            message: 'hello',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:05.000Z',
          },
        ],
        nextPageToken: 'cursor_2',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        runs: [],
        nextPageToken: null,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    const workflows = resource(fetch)

    const page = await workflows.runs.active({ pageSize: 10 })

    expect(page.items).toEqual([
      {
        runId: 'run-active',
        sessionId: 'agent_0_thread_1',
        status: 'running',
        message: 'hello',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:05.000Z',
      },
    ])
    expect(page.nextPageToken).toBe('cursor_2')
    expect(page.hasNextPage()).toBe(true)
    const firstUrl = new URL(String(fetch.mock.calls[0]?.[0]))
    expect(firstUrl.origin + firstUrl.pathname).toBe(
      'http://localhost:3130/agent/v1/runs/active',
    )
    expect(firstUrl.searchParams.get('pageSize')).toBe('10')
    expect(firstUrl.searchParams.get('pageToken')).toBeNull()
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
    })

    const nextPage = await page.getNextPage()
    expect(nextPage.items).toEqual([])
    const secondUrl = new URL(String(fetch.mock.calls[1]?.[0]))
    expect(secondUrl.searchParams.get('pageSize')).toBe('10')
    expect(secondUrl.searchParams.get('pageToken')).toBe('cursor_2')
  })

  it('looks up active conversation runs by session id through generated operation metadata', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      runs: [],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    const workflows = resource(fetch)

    await expect(
      workflows.runs.activeBySession(['agent_0_thread_1', ' agent_0_thread_1 ']),
    ).resolves.toEqual([])
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      'http://localhost:3130/agent/v1/runs/active-by-session',
    )
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ sessionIds: ['agent_0_thread_1'] }),
    })
  })

  it('executes workflow actions on agent-service with idempotency key', async () => {
    const fetch = vi.fn().mockResolvedValue(
      sseResponse(['data: {"type":"done","runId":"wf-123","threadId":""}\n\n']),
    )
    const workflows = resource(fetch)
    const run = await workflows.workflowActions.execute(
      {
        organizationId: 'org_123',
        sessionId: 'session-1',
        workflowAction: { toolName: 'lookup' },
      },
      { idempotencyKey: 'wf-123' },
    )

    for await (const _event of run.events) {
      // consume stream
    }

    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      'http://localhost:3130/agent/v1/workflow-actions',
    )
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({ 'Idempotency-Key': 'wf-123' }),
    })
  })
})
