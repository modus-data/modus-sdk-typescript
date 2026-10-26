import { describe, expect, it, vi } from 'vitest'
import { createModusConfig } from '../src/_config.js'
import { HttpClient } from '../src/_http.js'
import { WorkflowsResource } from '../src/resources/workflows.js'

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

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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

  it('createModus mints sessionId when omitted', async () => {
    const fetch = vi.fn().mockResolvedValue(
      sseResponse(['data: {"type":"done","runId":"modus-2","threadId":"t2"}\n\n']),
    )
    const workflows = resource(fetch)
    const run = workflows.runs.createModus({
      message: 'hi',
      organizationId: 'org_123',
    } as Parameters<typeof workflows.runs.createModus>[0])
    for await (const _ of run) {
      // drain
    }
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)) as { sessionId?: string }
    expect(typeof body.sessionId).toBe('string')
    expect(body.sessionId!.length).toBeGreaterThan(0)
    expect(fetch.mock.calls[0]?.[1]?.headers?.Accept).toBe('text/event-stream')
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

  it('interrupts with the follow-up turn and returns the new run', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(202, { runId: 'run-steer', status: 'pending' }))
    const workflows = resource(fetch)

    const admitted = await workflows.runs.interrupt(
      'run-123',
      { message: 'Use EMEA only.', sessionId: 'session-1' },
      { lastSeenEventId: '1717000000000-0' },
    )

    expect(admitted).toEqual({ runId: 'run-steer', status: 'pending' })
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      'http://localhost:3130/agent/v1/runs/run-123/interrupt',
    )
    const sent = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))
    expect(sent).toEqual({
      nextRun: { message: 'Use EMEA only.', sessionId: 'session-1', runId: expect.any(String) },
      lastSeenEventId: '1717000000000-0',
    })
    expect(sent.nextRun.runId).not.toBe('')
  })

  it('retries an interrupt with the same pinned run id, so a 5xx retry cannot start a second turn', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(500, { error: { code: 'INTERNAL_ERROR', message: 'boom' } }))
      .mockResolvedValueOnce(jsonResponse(202, { runId: 'run-steer', status: 'pending' }))
    const config = createModusConfig({
      apiKey: TEST_KEY,
      maxRetries: 1,
      baseUrls: { 'agent-service': 'http://localhost:3130' },
      fetch,
    })
    const workflows = new WorkflowsResource(new HttpClient(config), config)

    await workflows.runs.interrupt('run-123', { message: 'm', sessionId: 'session-1' })

    expect(fetch).toHaveBeenCalledTimes(2)
    const first = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))
    const second = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))
    expect(second.nextRun.runId).toBe(first.nextRun.runId)
  })

  it('keeps a caller-supplied nextRun.runId on interrupt', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(202, { runId: 'mine', status: 'pending' }))
    await resource(fetch).runs.interrupt('run-123', { message: 'm', sessionId: 's', runId: 'mine' })
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)).nextRun.runId).toBe('mine')
  })

  it('edits a queued run with the replacement turn and returns the run', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(200, { runId: 'run-q', status: 'queued' }))

    const edited = await resource(fetch).runs.editQueued('run-q', { message: 'edited', sessionId: 'session-1' })

    expect(edited).toEqual({ runId: 'run-q', status: 'queued' })
    expect(String(fetch.mock.calls[0]?.[0])).toBe('http://localhost:3130/agent/v1/runs/run-q/queue-edit')
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      nextRun: { message: 'edited', sessionId: 'session-1' },
    })
  })

  it.each([
    ['interrupt', (w: WorkflowsResource) => w.runs.interrupt('run-1', { message: 'm', sessionId: ' ' })],
    ['editQueued', (w: WorkflowsResource) => w.runs.editQueued('run-1', { message: 'm', sessionId: '' })],
  ])('%s refuses a blank sessionId before sending anything', async (_name, call) => {
    const fetch = vi.fn()
    await expect(call(resource(fetch))).rejects.toThrow(/sessionId/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('resumes with the decision and no message', async () => {
    const fetch = vi.fn().mockResolvedValue(
      sseResponse(['data: {"type":"done","runId":"run-c","threadId":"thread-1"}\n\n']),
    )
    const run = resource(fetch).runs.resume('run-1', { decision: 'approve', sessionId: 'session-1' })
    for await (const _event of run.events) {
      // consume stream
    }
    const sent = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))
    expect(sent).toMatchObject({ decision: 'approve', sessionId: 'session-1' })
    expect(sent).not.toHaveProperty('message')
  })

  it('refuses a resume without a sessionId instead of minting one', () => {
    const fetch = vi.fn()
    expect(() => resource(fetch).runs.resume('run-1', { decision: 'approve', sessionId: ' ' })).toThrow(/sessionId/)
    expect(fetch).not.toHaveBeenCalled()
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
