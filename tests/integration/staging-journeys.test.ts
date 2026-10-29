/**
 * Staging journeys — the release-gate scenarios of the API test plan (J1, J2, J4, J6), live.
 *
 * Same env as staging-smoke.test.ts. Optional:
 *   MODUS_READ_API_KEY        a read-only PAT in the same org, for the 403 `info.missing` check
 *   MODUS_APPROVAL_SCOPE_ID   a published scope whose one tool is approval-gated and writes nothing, for J2.4
 *   MODUS_MEMBER_API_KEY      another member's PAT in the same org, for J2.4's 404 on their resume
 *
 * Every check counts the requests it sends and asserts the whole error envelope
 * (`{error:{code,status,message,requestId,info}}`), not only the exception class.
 * Everything it creates is named `[API-Cleanse]` and deleted in `afterAll`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  AuthenticationError,
  BadRequestError,
  ConflictError,
  Modus,
  ModusError,
  NotFoundError,
  PermissionDeniedError,
  ValidationError,
} from '../../src/index.js'
import type { ChatResult, ChatSession } from '../../src/index.js'
import { ModusManagement } from '../../src/management/index.js'
import type { RunEvent } from '../../src/types/runs.js'

const hasLive = Boolean(process.env.MODUS_API_KEY)
const BASE = process.env.MODUS_BASE_URL || 'https://api.staging.getmodus.com'
const AGENT = (process.env.MODUS_AGENT_HOST || BASE.replace('//api.', '//agent.')).replace(/\/$/, '')
// The cheapest model the run policy admits; these journeys check plumbing, not answers.
const MODEL = 'gpt-oss-20b'
const PREFIX = '[API-Cleanse] smoke'
const stamp = `${new Date().toISOString().slice(11, 19).replace(/:/g, '')}-${crypto.randomUUID().slice(0, 6)}`

/** A fetch that records every request, so a check can assert how many went out (0 for a local refusal). */
function counter(): { sent: string[]; fetch: typeof fetch } {
  const sent: string[] = []
  return {
    sent,
    fetch: (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      sent.push(`${init?.method ?? 'GET'} ${url}`)
      return fetch(input, init)
    },
  }
}

const { sent, fetch: countingFetch } = counter()
// Without a key every describe below is skipped; the placeholder only lets the file collect.
const apiKey = process.env.MODUS_API_KEY || 'modus_00000000_unset'
const c = new Modus({ apiKey, baseUrl: BASE, timeoutMs: 180_000, fetch: countingFetch })
const m = new ModusManagement({ apiKey, baseUrl: BASE, timeoutMs: 120_000, fetch: countingFetch })

interface Expected {
  cls: abstract new (...args: never[]) => ModusError
  status: number
  code: string
  /** The envelope's `status` (gRPC-style). */
  grpc: string
  /** The exact `info`, or `'absent'`. Left unset, `info` is not checked (4xx only). */
  info?: Record<string, unknown> | 'absent'
}

/** Runs `call`, asserts it failed with the whole expected envelope after exactly `requests` requests. */
async function expectApiError(call: () => Promise<unknown>, want: Expected, requests = 1): Promise<ModusError> {
  sent.length = 0
  const err = await call().then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(err, 'call succeeded').toBeInstanceOf(want.cls)
  const e = err as ModusError
  expect({ status: e.statusCode, code: e.code }).toEqual({ status: want.status, code: want.code })
  expect(e.requestId).toMatch(/^req_/)
  const envelope = (JSON.parse(e.body ?? '{}') as { error?: Record<string, unknown> }).error
  expect(envelope).toMatchObject({ code: want.code, status: want.grpc, requestId: e.requestId, message: e.message })
  expect(String(envelope?.message)).not.toBe('')
  if (want.status >= 500 || want.info === 'absent') {
    expect(envelope?.info).toBeUndefined()
  } else if (want.info !== undefined) {
    expect(envelope?.info).toEqual(want.info)
    expect(e.info).toEqual(want.info)
  }
  expect(sent, 'requests sent').toHaveLength(requests)
  return e
}

/** Asserts a local argument refusal: a `ValidationError` (thrown or rejected), and nothing sent. */
async function expectLocalRefusal(call: () => Promise<unknown>): Promise<void> {
  sent.length = 0
  await expect(Promise.resolve().then(call)).rejects.toBeInstanceOf(ValidationError)
  expect(sent, 'requests sent').toEqual([])
}

async function raw(method: string, url: string, body?: unknown, apiKey = process.env.MODUS_API_KEY): Promise<{ status: number; json: Record<string, any> }> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, json: text ? JSON.parse(text) : {} }
}

const NOT_FOUND = { cls: NotFoundError, status: 404, code: 'NOT_FOUND', grpc: 'NOT_FOUND' } as const
const BAD_REQUEST = { cls: BadRequestError, status: 400, code: 'BAD_REQUEST', grpc: 'INVALID_ARGUMENT' } as const

/** Consume a run stream to its end: text, event types, the done frame and time to first token. */
async function drain(events: AsyncIterable<RunEvent>, startedAt = performance.now()) {
  let text = ''
  let ttftMs: number | undefined
  const types: string[] = []
  let done: (RunEvent & { type: 'done' }) | undefined
  for await (const e of events) {
    types.push(e.type)
    if (e.type === 'token' && e.content) {
      ttftMs ??= performance.now() - startedAt
      text += e.content
    }
    if (e.type === 'done') done = e
  }
  return { text, ttftMs, types, done }
}

describe.skipIf(!hasLive)('J4 ids, page sizes and error envelopes', () => {
  // A raw table: the server's contract, independent of any client.
  it.each([
    ['/api/v1/scopes', 0, 400],
    ['/api/v1/scopes', 1, 200],
    ['/api/v1/scopes', 100, 200],
    ['/api/v1/scopes', 101, 400],
    ['/api/v1/context/items', 0, 400],
    ['/api/v1/context/items', 200, 200],
    ['/api/v1/context/items', 201, 400],
    ['/api/v1/suggestions/questions', 0, 400],
    ['/api/v1/suggestions/questions', 12, 200],
    ['/api/v1/suggestions/questions', 13, 400],
    // Connections clamp instead of refusing.
    ['/api/v1/connections', 0, 200],
    ['/api/v1/connections', 101, 200],
  ])('GET %s?pageSize=%i → %i', async (path, pageSize, status) => {
    const res = await raw('GET', `${BASE}${path}?pageSize=${pageSize}`)
    expect(res.status).toBe(status)
    if (status === 400) {
      expect(res.json.error).toMatchObject({ code: 'BAD_REQUEST', status: 'INVALID_ARGUMENT' })
      expect(res.json.error.requestId).toMatch(/^req_/)
    }
  })

  it('pageSize 0 is refused locally with ValidationError; 101 is the server 400', async () => {
    await expectLocalRefusal(() => c.scopes.list({ pageSize: 0 }))
    await expectApiError(() => c.scopes.list({ pageSize: 101 }), BAD_REQUEST)
  })

  it('a bad key is a 401 AuthenticationError with the full envelope and no info', async () => {
    const bad = new Modus({ apiKey: 'modus_00000000_dead_beef_invalid_key_for_smoke', baseUrl: BASE, fetch: countingFetch })
    await expectApiError(() => bad.scopes.list({ pageSize: 1 }), {
      cls: AuthenticationError,
      status: 401,
      code: 'UNAUTHORIZED',
      grpc: 'UNAUTHENTICATED',
      info: 'absent',
    })
  })

  it.skipIf(!process.env.MODUS_READ_API_KEY)('a read-only key writing is a 403 naming the missing scope', async () => {
    const readOnly = new ModusManagement({ apiKey: process.env.MODUS_READ_API_KEY, baseUrl: BASE, fetch: countingFetch })
    await expectApiError(() => readOnly.scopes.create({ name: `${PREFIX} never-created ${stamp}` }), {
      cls: PermissionDeniedError,
      status: 403,
      code: 'FORBIDDEN',
      grpc: 'PERMISSION_DENIED',
      info: { required: ['scopes:write'], missing: ['scopes:write'] },
    })
    // Positive control: the same key reads, so the 403 is about the scope, not a dead key.
    expect(Array.isArray((await new Modus({ apiKey: process.env.MODUS_READ_API_KEY, baseUrl: BASE }).scopes.list({ pageSize: 1 })).items)).toBe(true)
  })

  // #9894: org-wide compose takes 26–84 s on staging, past API Gateway's 30 s cut on modus-api,
  // so it runs on the agent host (90 s deadline). The latency bound stays in staging-smoke.test.ts.
  it('N6: org-wide compose is served by the agent host and answers', async () => {
    sent.length = 0
    const composed = await c.modus.getContext('sdk staging smoke — list relevant tables', { limit: 3 })
    expect(sent.map((r) => new URL(r.split(' ')[1]!).origin)).toEqual([new URL(AGENT).origin])
    expect(typeof composed.context).toBe('string')
    expect(composed.sessionId).toBeTruthy()
  })
})

describe.skipIf(!hasLive)('J6 scope and workflow writes (+ J4 id table, J1 scope chat)', () => {
  let scopeId: number
  let managerId: number | undefined
  let workflowId: number | undefined
  const deleted = new Set<number>()

  beforeAll(async () => {
    const scope = await m.scopes.create({
      name: `${PREFIX} main ${stamp}`,
      description: 'smoke description',
      expectedOutput: 'smoke expected output',
      instructions: ['smoke instruction'],
    })
    scopeId = Number(scope.id)
    managerId = Number((await m.scopes.create({ name: `${PREFIX} manager ${stamp}` })).id)
  })

  afterAll(async () => {
    if (workflowId !== undefined) await m.workflows.delete(workflowId).catch(() => undefined)
    for (const id of [scopeId, managerId]) {
      if (id !== undefined && !deleted.has(id)) await m.scopes.delete(id).catch(() => undefined)
    }
  })

  it.each([
    [2147483647, 'NOT_FOUND from the service', { scopeId: 2147483647 }],
    [2147483648, 'above int4', { id: 2147483648 }],
    [0, 'zero', { id: 0 }],
    [-1, 'negative', { id: -1 }],
  ])('scopes.get(%s) (%s) → NotFoundError, 1 request', async (id, _label, info) => {
    await expectApiError(() => c.scopes.get(id), { ...NOT_FOUND, info })
  })

  it.each(['1.5', 'revenue-analysis'])('scopes.get(%j) → BadRequestError, 1 request', async (id) => {
    await expectApiError(() => c.scopes.get(id), BAD_REQUEST)
  })

  it.each(['', '.', '..'])('scopes.get(%j) → ValidationError, 0 requests', async (id) => {
    await expectLocalRefusal(() => c.scopes.get(id))
  })

  it('scopes.get("<id>.0") is the same scope as <id>, 1 request', async () => {
    sent.length = 0
    expect((await c.scopes.get(`${scopeId}.0`)).id).toBe(scopeId)
    expect(sent).toHaveLength(1)
  })

  it('a nested update_mask sends only the named fields and leaves accessConfig alone', async () => {
    const before = await m.scopes.get(scopeId, { view: 'draft' })
    sent.length = 0
    const after = await m.scopes.update(scopeId, { name: `${PREFIX} main2 ${stamp}`, updateMask: 'name,accessConfig.visibility' })
    expect(sent).toHaveLength(1)
    expect(after.name).toBe(`${PREFIX} main2 ${stamp}`)
    expect(after.accessConfig).toEqual(before.accessConfig)
  })

  it('a masked field left unset is cleared (sent as null)', async () => {
    sent.length = 0
    await m.scopes.update(scopeId, { name: `${PREFIX} main3 ${stamp}`, updateMask: 'name,description' })
    expect(sent, 'PATCH re-sent: the server failed').toHaveLength(1)
    const reread = await m.scopes.get(scopeId, { view: 'draft' })
    expect(reread.description ?? '').toBe('')
    expect(reread.variation?.expectedOutput).toBe('smoke expected output')
  })

  it('N4: an omitted field is kept; a masked null on a non-clearable field is a 400 and writes nothing', async () => {
    await m.scopes.update(scopeId, { description: 'kept description' })
    await m.scopes.update(scopeId, { name: `${PREFIX} main4 ${stamp}` })
    expect((await m.scopes.get(scopeId, { view: 'draft' })).description).toBe('kept description')
    await expectApiError(() => m.scopes.update(scopeId, { updateMask: 'name' }), BAD_REQUEST)
    expect((await m.scopes.get(scopeId, { view: 'draft' })).name).toBe(`${PREFIX} main4 ${stamp}`)
  })

  it('managerId moves the scope under a manager (int), the list filter finds it, null detaches', async () => {
    await m.scopes.update(scopeId, { managerId })
    const manager = await m.scopes.get(managerId!, { view: 'draft' })
    expect(manager.variation?.supervisionSubordinateIds?.map(String)).toContain(String(scopeId))
    const filtered = await m.scopes.list({ managerId, pageSize: 100 })
    expect(filtered.items.map((s) => s.id).sort()).toEqual([scopeId])
    await m.scopes.update(scopeId, { managerId: null })
  })

  it('toolset {} clears the tools, confirmed on a draft re-read', async () => {
    await m.scopes.update(scopeId, { toolset: { memory: { enabled: true } } })
    await m.scopes.update(scopeId, { toolset: {} })
    expect((await m.scopes.get(scopeId, { view: 'draft' })).variation?.toolset).toEqual({})
  })

  it('memories: a missing memory is a 404 on update and delete', async () => {
    const missing = '00000000-0000-4000-8000-000000000000'
    await expectApiError(() => m.scopes.memories(scopeId).update(missing, { memory: 'x' }), NOT_FOUND)
    await expectApiError(() => m.scopes.memories(scopeId).delete(missing), NOT_FOUND)
  })

  it("memories.delete('..') sends nothing and the scope survives", async () => {
    await expectLocalRefusal(() => m.scopes.memories(scopeId).delete('..'))
    expect((await c.scopes.get(scopeId)).id).toBe(scopeId)
  })

  it('J1: a token run of a scope draft is a 403 before any token, 1 request', async () => {
    await expectApiError(
      () => drain(c.workflows.runs.createScope(scopeId, { message: 'hi', sessionId: crypto.randomUUID(), version: 'draft', config: { model: MODEL } })),
      { cls: PermissionDeniedError, status: 403, code: 'FORBIDDEN', grpc: 'PERMISSION_DENIED' },
    )
  })

  it('J1: a deployed scope streams its first token within 10 s, and its conversation lists the turn', async () => {
    await m.scopes.deploy(scopeId)
    const started = performance.now()
    const chat = c.scopes.chat(scopeId, 'Reply with exactly one short word.', { model: MODEL })
    let tokens = 0
    let ttftMs: number | undefined
    for await (const token of chat.textStream()) {
      if (token) {
        ttftMs ??= performance.now() - started
        tokens += 1
      }
    }
    const final = await chat
    expect(tokens).toBeGreaterThan(0)
    expect(ttftMs, 'time to first token').toBeLessThan(10_000)
    expect(final.content).not.toBe('')
    const convos = await c.scopes.conversations(scopeId).list({ pageSize: 10 })
    expect(convos.items.map((t) => t.threadId)).toContain(final.threadId)
  })

  // That `guardrails` is a type error on create is asserted at L2 (management-rest.test.ts).
  it('workflows: create without guardrails, a non-uuid interface id is a 400, deploy then disable', async () => {
    const wf = await m.workflows.create({
      name: `${PREFIX} workflow ${stamp}`,
      type: 'workflow',
      trigger: { trigger_type: 'manual' },
      agentSelection: { agents: [{ agent_id: scopeId, priority_order: 1 }] },
    })
    workflowId = Number(wf.id)
    await expectApiError(() => m.workflows.interfaces(workflowId!).update('not-a-uuid', { name: 'x' }), BAD_REQUEST)
    // Positive control: the same workflow's interfaces are reachable.
    expect(Array.isArray(await m.workflows.interfaces(workflowId).list())).toBe(true)
    await m.workflows.deploy(workflowId)
    expect((await m.workflows.toggle(workflowId, { active: false })).isEnabled).toBe(false)
    expect((await m.workflows.get(workflowId)).isEnabled).toBe(false)
  })

  it('N4: a workflow description clears to "", a masked null name is a 400 and writes nothing', async () => {
    expect(workflowId).toBeDefined()
    await m.workflows.update(workflowId!, { description: 'wf description' })
    await m.workflows.update(workflowId!, { updateMask: 'description' })
    const cleared = await m.workflows.get(workflowId!, { view: 'draft' })
    expect(cleared.description ?? '').toBe('')
    await expectApiError(() => m.workflows.update(workflowId!, { updateMask: 'name' }), BAD_REQUEST)
    expect((await m.workflows.get(workflowId!)).name).toBe(`${PREFIX} workflow ${stamp}`)
  })

  it('N4: a context item clears description and topics; content is not clearable', async () => {
    const { contextItemId: uid } = await m.context.createNote(`${PREFIX} note ${stamp}`, 'smoke note body')
    try {
      await m.context.items.update(uid, { description: 'note description', topics: ['smoke'] })
      const cleared = await m.context.items.update(uid, { updateMask: 'description,topics' })
      expect(cleared.description ?? null).toBeNull()
      expect(cleared.topics ?? []).toEqual([])
      await expectApiError(() => m.context.items.update(uid, { updateMask: 'content' }), BAD_REQUEST)
      expect(JSON.stringify((await c.context.items.get(uid)).content)).toContain('smoke note body')
    } finally {
      await m.context.items.delete(uid)
    }
  })

  it('a deleted scope is a 404 on the second delete', async () => {
    await m.scopes.delete(managerId!)
    deleted.add(managerId!)
    await expectApiError(() => m.scopes.delete(managerId!), NOT_FOUND)
  })
})

describe.skipIf(!hasLive)('J1 chat on the agent host', () => {
  let threadId: string | undefined

  it('a client with no agentHost derives the agent host and streams a reply', async () => {
    const own = counter()
    const saved = process.env.MODUS_AGENT_HOST
    delete process.env.MODUS_AGENT_HOST
    let derived: Modus
    try {
      derived = new Modus({ baseUrl: BASE, timeoutMs: 180_000, fetch: own.fetch })
    } finally {
      if (saved !== undefined) process.env.MODUS_AGENT_HOST = saved
    }
    const started = performance.now()
    const run = await drain(
      derived.modus.chat('My favourite fruit is the tangerine. Reply with exactly: noted', { model: MODEL }).eventStream(),
      started,
    )
    expect(new URL(own.sent[0]!.split(' ')[1]!).host).toBe(new URL(BASE).host.replace(/^api\./, 'agent.'))
    threadId = run.done?.threadId
    expect(own.sent).toHaveLength(1)
    expect(run.text).not.toBe('')
    expect(threadId).toBeTruthy()
    // The SDK surfaces `done.content` (#9704); the server sends it since #9693.
    expect(run.done?.content, 'done frame content').toBeTruthy()
    // Not gated: org-wide composition runs before the first token and takes 17–34 s on staging
    // (composer latency, finding F2, owner nirch). The 10 s bound is gated on the scope chat in J6.
    console.info(`org chat time to first token: ${Math.round(run.ttftMs ?? -1)} ms`)
  })

  it('a second turn on the same thread keeps the context', async () => {
    expect(threadId).toBeTruthy()
    const reply = await c.modus.chat('What is my favourite fruit? Reply with one word.', { model: MODEL, threadId })
    expect(reply.content.toLowerCase()).toContain('tangerine')
    const convo = await c.modus.conversations.get(threadId!)
    const human = convo.messages.filter((msg) => msg.type === 'human').map((msg) => msg.content)
    expect(human).toHaveLength(2)
  })

  it('a custom baseUrl with no agent host is a configuration error before any request', async () => {
    const own = counter()
    const saved = process.env.MODUS_AGENT_HOST
    delete process.env.MODUS_AGENT_HOST
    // A fake key and a fetch that never sends: this must not reach a real host either way.
    const stub: typeof fetch = async (input, init) => {
      own.sent.push(`${init?.method ?? 'GET'} ${String(input instanceof Request ? input.url : input)}`)
      throw new TypeError('blocked by the smoke')
    }
    try {
      const custom = new Modus({ apiKey: 'modus_00000000_fake', baseUrl: 'https://modus.example.internal', fetch: stub, maxRetries: 0 })
      await expect(custom.modus.chat('x', { model: MODEL }).result()).rejects.toThrow(/agent host/i)
    } finally {
      if (saved !== undefined) process.env.MODUS_AGENT_HOST = saved
    }
    expect(own.sent).toEqual([])
  })

  it('the high-level chat refuses an unknown model locally: ValidationError, 0 requests', async () => {
    await expectLocalRefusal(() => c.modus.chat('hi', { model: 'not-a-model' as never }).result())
  })

  it('closing the stream does not cancel the run: it runs to completion', async () => {
    const run = c.workflows.runs.createModus({ message: 'Count from 1 to 60, one number per line, no other text.', sessionId: crypto.randomUUID(), config: { model: MODEL } })
    for await (const e of run) if (e.type === 'token' && e.content) break
    const rest = await drain(c.workflows.runs.stream(run.runId))
    expect(rest.types.at(-1)).toBe('done')
    expect(rest.text).toContain('60')
  })

  // #9867: before it the SDK parsed only `data:` lines, so an embedder had no id to resume a dropped stream from.
  it('run events carry the SSE id, and runs.stream resumes from it', async () => {
    const run = c.workflows.runs.createModus({ message: 'Reply with exactly: ok', sessionId: crypto.randomUUID(), config: { model: MODEL } })
    const ids: string[] = []
    for await (const e of run) {
      const id = (e as { id?: string }).id
      if (id) ids.push(id)
    }
    expect(ids.length).toBeGreaterThan(0)
    const replay = await drain(c.workflows.runs.stream(run.runId, { lastEventId: ids[0] }))
    expect(replay.types.at(-1)).toBe('done')
  })

  it.each([
    ['an unknown model', { message: 'hi', config: { model: 'not-a-model' } }, /Unknown model/],
    ['a 32,001-character message', { message: 'x'.repeat(32_001), config: { model: MODEL } }, /32000/],
  ])('raw run POST: %s is a 400 before any event, after 1 request', async (_label, body, message) => {
    const e = await expectApiError(() => drain(c.workflows.runs.createModus(body as never)), { ...BAD_REQUEST, info: 'absent' })
    expect(e.message).toMatch(message)
  })

  // #9704 removed the buffered routes: API Gateway → Nest must answer 404, not a validation 400.
  it.each([
    '/api/v1/modus/chat',
    '/api/v1/modus/conversations/00000000-0000-4000-8000-000000000000/chat',
    '/api/v1/scopes/2147483647/chat',
    '/api/v1/scopes/2147483647/conversations/00000000-0000-4000-8000-000000000000/chat',
    '/api/v1/workflows/2147483647/chat',
    '/api/v1/workflows/2147483647/conversations/00000000-0000-4000-8000-000000000000/chat',
  ])('POST %s → 404 NOT_FOUND', async (path) => {
    const res = await raw('POST', `${BASE}${path}`, {})
    expect(res.status).toBe(404)
    expect(res.json.error).toMatchObject({ code: 'NOT_FOUND', status: 'NOT_FOUND' })
    expect(res.json.error.requestId).toMatch(/^req_/)
  })
})

describe.skipIf(!hasLive)('J2 run lifecycle', () => {
  const runs = c.workflows.runs

  it('interrupting a running run admits the follow-up, ends the first as cancelled, and the follow-up streams', async () => {
    const sessionId = crypto.randomUUID()
    const first = runs.createModus({ message: 'Count from 1 to 400, one number per line, no other text.', sessionId, config: { model: MODEL } })
    const types: string[] = []
    let admission: Awaited<ReturnType<typeof runs.interrupt>> | undefined
    for await (const e of first) {
      types.push(e.type)
      if (e.type === 'token' && admission === undefined) {
        sent.length = 0
        admission = await runs.interrupt(first.runId, { message: 'Reply with exactly: ok', sessionId })
        expect(sent).toHaveLength(1)
      }
    }
    expect(admission).toMatchObject({ runId: expect.any(String), status: expect.any(String) })
    expect(admission!.runId).not.toBe(first.runId)
    expect(types.at(-1)).toBe('cancelled')
    const next = await drain(runs.stream(admission!.runId))
    expect(next.done).toBeTruthy()
    expect(next.text.toLowerCase()).toContain('ok')
  })

  it('a queued turn can be edited, and the edited message is the one that runs', async () => {
    const sessionId = crypto.randomUUID()
    const busy = runs.createModus({ message: 'Count from 1 to 1000, one number per line, no other text.', sessionId, config: { model: MODEL } })
    const busyIt = busy[Symbol.asyncIterator]()
    expect((await busyIt.next()).value?.type).toBeDefined()
    const queued = runs.createModus({ message: 'Reply with exactly: original', sessionId, config: { model: MODEL } })
    const queuedIt = queued[Symbol.asyncIterator]()
    const queuedDone = (async () => {
      for (let n = await queuedIt.next(); !n.done; n = await queuedIt.next()) if (n.value.type === 'done') break
    })()
    // The queued run exists only once its POST is admitted: retry the 404 briefly.
    let admission: Awaited<ReturnType<typeof runs.editQueued>> | undefined
    for (let attempt = 0; admission === undefined && attempt < 30; attempt++) {
      await new Promise((r) => setTimeout(r, 200))
      admission = await runs.editQueued(queued.runId, { message: 'Reply with exactly: edited', sessionId }).catch((e: unknown) => {
        if (e instanceof NotFoundError) return undefined
        throw e
      })
    }
    expect(admission).toEqual({ runId: queued.runId, status: 'queued' })
    await busyIt.return?.()
    await queuedDone
    const edited = await drain(runs.stream(queued.runId))
    expect(edited.text.toLowerCase()).toContain('edited')
    // Editing a run that already ran is a 409 with the full envelope.
    await expectApiError(() => runs.editQueued(queued.runId, { message: 'too late', sessionId }), {
      cls: ConflictError,
      status: 409,
      code: 'CONFLICT',
      grpc: 'ALREADY_EXISTS',
    })
  })

  it('interrupting a finished run starts a follow-up turn', async () => {
    const sessionId = crypto.randomUUID()
    const first = runs.createModus({ message: 'Reply with exactly: one', sessionId, config: { model: MODEL } })
    expect((await drain(first)).done).toBeTruthy()
    const admission = await runs.interrupt(first.runId, { message: 'Reply with exactly: two', sessionId })
    const follow = await drain(runs.stream(admission.runId))
    expect(follow.text.toLowerCase()).toContain('two')
  })

  // #9867: before it a resume with nothing pending answered 200 and an SSE `error` frame, and the
  // thread failed every later turn with "400 invalid request".
  it('a stale resume is a 409 before any frame, and the conversation stays usable', async () => {
    const sessionId = crypto.randomUUID()
    const first = runs.createModus({ message: 'Reply with exactly: one', sessionId, config: { model: MODEL } })
    await drain(first)
    await expectApiError(() => drain(runs.resume(first.runId, { sessionId, decision: 'approve' })), {
      cls: ConflictError,
      status: 409,
      code: 'CONFLICT',
      grpc: 'ALREADY_EXISTS',
    })
    const next = await drain(runs.createModus({ message: 'Reply with exactly: two', sessionId, config: { model: MODEL } }))
    expect(next.types).not.toContain('error')
    expect(next.text.toLowerCase()).toContain('two')
  })

  it.each(['interrupt', 'queue-edit'])('a raw {} body on %s is a 400, not a 500', async (verb) => {
    const res = await raw('POST', `${AGENT}/agent/v1/runs/${crypto.randomUUID()}/${verb}`, {})
    expect(res.status).toBe(400)
    expect(res.json.error).toMatchObject({ code: 'BAD_REQUEST', status: 'INVALID_ARGUMENT', message: 'nextRun should not be null or undefined' })
  })

  it('resume, interrupt and editQueued refuse a blank sessionId locally with ValidationError', async () => {
    const runId = crypto.randomUUID()
    await expectLocalRefusal(async () => drain(runs.resume(runId, { decision: 'approve', sessionId: '' } as never)))
    await expectLocalRefusal(() => runs.interrupt(runId, { message: 'x', sessionId: ' ' }))
    await expectLocalRefusal(() => runs.editQueued(runId, { message: 'x', sessionId: '' }))
  })
})

// J2.4 needs a published scope whose only tool is approval-gated and cannot write: on staging,
// scope 1553 `[API-Cleanse] approval-fixture`, GitLab "Comment on Issue" pinned by its
// instructions to project_id 0. GitLab ids start at 1, so even an approved call is a 404 there.
// Unset, it is skipped; the staging-smoke action annotates the run with a warning.
const APPROVAL_SCOPE = process.env.MODUS_APPROVAL_SCOPE_ID

describe.skipIf(!hasLive || !APPROVAL_SCOPE)('J2.4 write approval on a scope (MODUS_APPROVAL_SCOPE_ID)', () => {
  // The fixture's pinned tool call needs a model that follows it; the cheap one may not call tools.
  const APPROVAL_MODEL = 'claude-sonnet-5'
  const scopeId = Number(APPROVAL_SCOPE)
  let chat: ChatSession | undefined
  let first: ChatResult | undefined

  it('a turn that calls the gated tool stops with result.approval, before the write', async () => {
    chat = c.scopes.chat(scopeId, 'Post the test comment.', { model: APPROVAL_MODEL })
    first = await chat
    expect(first.approval).toMatchObject({ type: 'approval_required', toolName: expect.any(String), id: expect.any(String) })
    expect(String(first.approval?.args?.project_id), 'the fixture pins project 0').toBe('0')
  })

  it('approve continues and completes, a second resume is a 409, the next turn answers', async () => {
    expect(String(first?.approval?.args?.project_id), 'approve only the fixture call').toBe('0')
    const memberKey = process.env.MODUS_MEMBER_API_KEY
    if (memberKey) {
      // Another member's token cannot answer the owner's approval (404).
      const member = new Modus({ apiKey: memberKey, baseUrl: BASE, fetch: countingFetch })
      await expectApiError(() => drain(member.workflows.runs.resume(first!.runId, { sessionId: first!.threadId, decision: 'approve' })), NOT_FOUND)
    }
    const done = await chat!.resume({ decision: 'approve' })
    expect(done.approval).toBeUndefined()
    expect(done.content).not.toBe('')
    await expectApiError(() => chat!.resume({ decision: 'approve' }).result(), {
      cls: ConflictError,
      status: 409,
      code: 'CONFLICT',
      grpc: 'ALREADY_EXISTS',
    })
    const next = await c.scopes.chat(scopeId, 'Reply with exactly: pong', { model: MODEL, threadId: first!.threadId })
    expect(next.content.toLowerCase()).toContain('pong')
  })
})
