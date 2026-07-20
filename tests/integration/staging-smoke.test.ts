/**
 * Staging journey smoke — real PAT against staging (or any reachable API).
 *
 * Env:
 *   MODUS_API_KEY   required
 *   MODUS_BASE_URL  default https://api.staging.getmodus.com
 *   MODUS_SCOPE_ID  optional
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

  it('auth → browse → pagination → compose → note write/cleanup → typed errors', async () => {
    const c = client()
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
    }

    const workflows = await c.workflows.list({ pageSize: 5 })
    expect(Array.isArray(workflows.items)).toBe(true)

    const notes = await c.context.items.list({ pageSize: 1, contextType: 'note' })
    expect(Array.isArray(notes.items)).toBe(true)

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

    const m = mgmt()
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

    await expect(c.scopes.get('__sdk_staging_smoke_missing_scope__')).rejects.toBeInstanceOf(
      NotFoundError,
    )

    const bad = new Modus({
      apiKey: 'modus_00000000_dead_beef_invalid_key_for_smoke',
      baseUrl: baseUrl(),
      timeoutMs: 30_000,
    })
    await expect(bad.scopes.list({ pageSize: 1 })).rejects.toBeInstanceOf(AuthenticationError)
  }, 180_000)
})
