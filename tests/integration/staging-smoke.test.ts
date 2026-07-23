/**
 * Staging journey smoke — real PAT against staging (or any reachable API).
 *
 * Env:
 *   MODUS_API_KEY     required
 *   MODUS_BASE_URL    default https://api.staging.getmodus.com
 *   MODUS_AGENT_HOST  default https://agent.staging.getmodus.com (chat/stream)
 *   MODUS_SMOKE_MODEL default claude-sonnet-5
 *   MODUS_SCOPE_ID    optional
 *
 * Run:
 *   export MODUS_API_KEY=modus_...
 *   export MODUS_BASE_URL=https://api.staging.getmodus.com
 *   pnpm test:staging-smoke
 */
import { afterAll, describe, expect, it } from 'vitest'
import { AuthenticationError, Modus, NotFoundError } from '../../src/index.js'
import { ModusManagement } from '../../src/management/index.js'

const DEFAULT_STAGING = 'https://api.staging.getmodus.com'
const hasLive = Boolean(process.env.MODUS_API_KEY)

function baseUrl(): string {
  return process.env.MODUS_BASE_URL || DEFAULT_STAGING
}

function client(): Modus {
  return new Modus({ baseUrl: baseUrl(), timeoutMs: 120_000 })
}

function mgmt(): ModusManagement {
  return new ModusManagement({ baseUrl: baseUrl(), timeoutMs: 120_000 })
}

describe.skipIf(!hasLive)('staging journey smoke', () => {
  let createdUid: string | undefined

  afterAll(async () => {
    if (!createdUid) return
    try {
      await mgmt().context.items.delete(createdUid)
    } catch {
      // best-effort cleanup if the test body already deleted
    }
  })

  it('auth → browse → pagination → compose → mgmt reads → note write → errors', async () => {
    const c = client()
    const m = mgmt()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const runId = crypto.randomUUID().slice(0, 8)

    const scopes = await c.scopes.list({ pageSize: 5 })
    expect(Array.isArray(scopes.items)).toBe(true)

    let scopeId = process.env.MODUS_SCOPE_ID
    if (!scopeId && scopes.items[0]?.id != null) {
      scopeId = String(scopes.items[0].id)
    }

    if (scopeId) {
      const got = await c.scopes.get(scopeId)
      expect(got.id).toBeTruthy()
      const convos = await c.scopes.conversations(scopeId).list({ pageSize: 5 })
      expect(Array.isArray(convos.items)).toBe(true)
    }

    const workflows = await c.workflows.list({ pageSize: 5 })
    expect(Array.isArray(workflows.items)).toBe(true)
    if (workflows.items[0]?.id != null) {
      const wf = await c.workflows.get(workflows.items[0].id)
      expect(wf.id).toBeTruthy()
    }

    const notes = await c.context.items.list({ pageSize: 1, contextType: 'note' })
    expect(Array.isArray(notes.items)).toBe(true)

    const connections = await c.connections.list({ pageSize: 5 })
    expect(Array.isArray(connections.items)).toBe(true)

    const suggestions = await c.suggestions.list({ pageSize: 5 })
    expect(Array.isArray(suggestions.items)).toBe(true)

    const activeRuns = await c.workflows.runs.active({ pageSize: 5 })
    expect(Array.isArray(activeRuns.items)).toBe(true)

    const page1 = await c.scopes.list({ pageSize: 1 })
    if (page1.nextPageToken) {
      const page2 = await c.scopes.list({ pageSize: 1, pageToken: page1.nextPageToken })
      expect(Array.isArray(page2.items)).toBe(true)
    }

    const composed = await c.modus.getContext('sdk staging smoke — list relevant tables', {
      limit: 3,
    })
    expect(composed).toBeTruthy()

    if (scopeId) {
      const scopeComposed = await c.scopes.getContext(scopeId, 'sdk staging smoke — brief context', {
        limit: 3,
      })
      expect(scopeComposed).toBeTruthy()
    }

    const mgmtScopes = await m.scopes.list({ pageSize: 5 })
    expect(Array.isArray(mgmtScopes.items)).toBe(true)

    const members = await m.users.listOrgMembers()
    expect(Array.isArray(members)).toBe(true)

    const until = new Date()
    const since = new Date(until.getTime() - 24 * 60 * 60 * 1000)
    const usage = await m.usage.list({
      since: since.toISOString(),
      until: until.toISOString(),
      rollup: 'day',
    })
    expect(usage).toBeTruthy()

    const title = `[SDK Staging Smoke] ${stamp}-${runId}`
    const created = await m.context.createNote(title, 'staging smoke note — safe to delete')
    createdUid = created.contextItemId
    const item = await c.context.items.get(createdUid)
    const updated = await m.context.updateNote(createdUid, {
      title: `${title} (updated)`,
      body: 'updated by staging smoke',
      existing: item,
    })
    expect(updated.uid).toBe(createdUid)
    await m.context.items.delete(createdUid)
    createdUid = undefined

    // Scope path param is numeric (ParseIntPipe); a missing id → 404.
    await expect(c.scopes.get(999_999_999)).rejects.toBeInstanceOf(NotFoundError)

    const bad = new Modus({
      apiKey: 'modus_00000000_dead_beef_invalid_key_for_smoke',
      baseUrl: baseUrl(),
      timeoutMs: 30_000,
    })
    await expect(bad.scopes.list({ pageSize: 1 })).rejects.toBeInstanceOf(AuthenticationError)
  }, 240_000)

  it('buffered chat + streaming via agent host', async () => {
    const model = (process.env.MODUS_SMOKE_MODEL || 'claude-sonnet-5') as import('../../src/types/chat.js').ChatModel
    const agentHost =
      process.env.MODUS_AGENT_HOST || 'https://agent.staging.getmodus.com'
    const c = new Modus({
      baseUrl: baseUrl(),
      agentHost,
      timeoutMs: 180_000,
    })

    const buffered = await c.modus.chat('sdk staging smoke — reply with one short word', {
      model,
    })
    expect(buffered.content?.length).toBeGreaterThan(0)
    expect(buffered.threadId).toBeTruthy()

    const stream = c.modus.chatStream('sdk staging smoke — stream one short word', {
      model,
    })
    let tokens = 0
    for await (const chunk of stream.textStream()) {
      if (chunk.length > 0) tokens += 1
    }
    const final = stream.getFinalResult()
    expect(tokens).toBeGreaterThan(0)
    expect(final.content?.length).toBeGreaterThan(0)
    expect(final.threadId || final.runId).toBeTruthy()

    // createModus must mint sessionId + negotiate SSE (not JSON pending).
    let createTokens = 0
    const createRun = c.workflows.runs.createModus({
      message: 'sdk staging smoke — createModus one short word',
      config: { model },
    } as Parameters<typeof c.workflows.runs.createModus>[0])
    for await (const event of createRun) {
      if (event.type === 'token' && event.content.length > 0) {
        createTokens += 1
      }
    }
    expect(createTokens).toBeGreaterThan(0)
  }, 300_000)
})
