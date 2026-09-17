import { describe, expect, it, vi } from 'vitest'
import { ModusManagement } from '../src/management/index.js'

const TEST_KEY = 'modus_test_key_dashboards'
const BASE = 'https://api.getmodus.com'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function managementWith(fetch: ReturnType<typeof vi.fn>): ModusManagement {
  return new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
}

function requestOf(fetch: ReturnType<typeof vi.fn>): { url: string; method: string | undefined; body: unknown } {
  const [url, init] = fetch.mock.calls[0] as [unknown, RequestInit]
  return {
    url: String(url),
    method: init.method,
    body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
  }
}

const ELEMENT = {
  dashboardId: 'dash-1',
  draftRevision: 4,
  element: { id: 'tile-1', kind: 'chart', title: 'Sales by region' },
}

describe('mgmt.context.dashboards.elements(id)', () => {
  it('list() gets the elements of the pinned dashboard, encoding the id', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({ dashboardId: 'dash/1', draftRevision: 2, elements: [] }),
    )
    const listed = await managementWith(fetch).context.dashboards.elements('dash/1').list()
    expect(listed.draftRevision).toBe(2)
    const request = requestOf(fetch)
    expect(request.method).toBe('GET')
    expect(request.url).toContain('/api/v1/context/dashboards/dash%2F1/elements')
  })

  it('get() fetches one element', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(ELEMENT))
    const result = await managementWith(fetch).context.dashboards.elements('dash-1').get('tile-1')
    expect(result.element.title).toBe('Sales by region')
    const request = requestOf(fetch)
    expect(request.method).toBe('GET')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1/elements/tile-1')
  })

  it('create() posts the element body', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(ELEMENT, 201))
    const created = await managementWith(fetch).context.dashboards.elements('dash-1').create({
      expectedRevision: 3,
      kind: 'chart',
      title: 'Sales by region',
      layout: { x: 0, y: 4, w: 6, h: 4 },
    })
    expect(created.element.id).toBe('tile-1')
    const request = requestOf(fetch)
    expect(request.method).toBe('POST')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1/elements')
    expect(request.body).toEqual({
      expectedRevision: 3,
      kind: 'chart',
      title: 'Sales by region',
      layout: { x: 0, y: 4, w: 6, h: 4 },
    })
  })

  it('update() patches one element and returns the dashboard', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ id: 'dash-1', draftRevision: 3 }))
    const dashboard = await managementWith(fetch)
      .context.dashboards.elements('dash-1')
      .update('tile-1', { expectedRevision: 2, patch: { title: 'Revenue', defaultValue: null } })
    expect(dashboard.draftRevision).toBe(3)
    const request = requestOf(fetch)
    expect(request.method).toBe('PATCH')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1/elements/tile-1')
    expect(request.body).toEqual({ expectedRevision: 2, patch: { title: 'Revenue', defaultValue: null } })
  })

  it('rejects blank ids before any request', async () => {
    const fetch = vi.fn()
    const dashboards = managementWith(fetch).context.dashboards
    expect(() => dashboards.elements(' ')).toThrow(/dashboardId/)
    const elements = dashboards.elements('dash-1')
    await expect(elements.get('')).rejects.toThrow(/elementId/)
    await expect(elements.update('', { expectedRevision: 1, patch: { title: 'x' } })).rejects.toThrow(/elementId/)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('mgmt.context.dashboards.updateLayout()', () => {
  it('patches the layout of several elements', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ id: 'dash-1', draftRevision: 3 }))
    const elements = [{ elementId: 'tile-1', layout: { x: 0, y: 0, w: 12, h: 2 } }]
    const dashboard = await managementWith(fetch).context.dashboards.updateLayout('dash-1', {
      expectedRevision: 2,
      elements,
    })
    expect(dashboard.draftRevision).toBe(3)
    const request = requestOf(fetch)
    expect(request.method).toBe('PATCH')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1/layout')
    expect(request.body).toEqual({ expectedRevision: 2, elements })
  })

  it('rejects a blank dashboard id before any request', async () => {
    const fetch = vi.fn()
    await expect(
      managementWith(fetch).context.dashboards.updateLayout('', { expectedRevision: 1, elements: [] }),
    ).rejects.toThrow(/dashboardId/)
    expect(fetch).not.toHaveBeenCalled()
  })
})

const DASHBOARD = { id: 'dash-1', title: 'Revenue', draftRevision: 3 }

describe('mgmt.context.dashboards document operations', () => {
  it('list() sends the draft view and unwraps dashboards', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ dashboards: [DASHBOARD] }))
    const dashboards = await managementWith(fetch).context.dashboards.list({ view: 'draft' })
    expect(dashboards[0]?.id).toBe('dash-1')
    const request = requestOf(fetch)
    expect(request.method).toBe('GET')
    expect(request.url).toContain('/api/v1/context/dashboards?view=draft')
  })

  it('list() without options sends no view', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ dashboards: [] }))
    await expect(managementWith(fetch).context.dashboards.list()).resolves.toEqual([])
    expect(requestOf(fetch).url).not.toContain('view=')
  })

  it('create() posts the dashboard body', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(DASHBOARD, 201))
    const input = {
      title: 'Revenue',
      description: 'Monthly revenue',
      definition: { tiles: [], filters: [] },
      access: { visibility: 'private' as const, groupPermissions: {}, sharedWith: [] },
    }
    const dashboard = await managementWith(fetch).context.dashboards.create(input)
    expect(dashboard.id).toBe('dash-1')
    const request = requestOf(fetch)
    expect(request.method).toBe('POST')
    expect(request.url).toMatch(/\/api\/v1\/context\/dashboards$/)
    expect(request.body).toEqual(input)
  })

  it('get() fetches one dashboard with a view, encoding the id', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(DASHBOARD))
    const dashboard = await managementWith(fetch).context.dashboards.get('dash/1', { view: 'active' })
    expect(dashboard.title).toBe('Revenue')
    const request = requestOf(fetch)
    expect(request.method).toBe('GET')
    expect(request.url).toContain('/api/v1/context/dashboards/dash%2F1?view=active')
  })

  it('updateDraft() patches the draft', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ ...DASHBOARD, draftRevision: 4 }))
    const dashboard = await managementWith(fetch).context.dashboards.updateDraft('dash-1', {
      expectedRevision: 3,
      title: 'Revenue v2',
      definition: { tiles: [], filters: [] },
    })
    expect(dashboard.draftRevision).toBe(4)
    const request = requestOf(fetch)
    expect(request.method).toBe('PATCH')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1/draft')
    expect(request.body).toEqual({
      expectedRevision: 3,
      title: 'Revenue v2',
      definition: { tiles: [], filters: [] },
    })
  })

  it('publish() returns the dashboard and the published version', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({ dashboard: DASHBOARD, version: { uid: 'ver-1', kind: 'published', versionNumber: 2 } }, 201),
    )
    const result = await managementWith(fetch).context.dashboards.publish('dash-1', { expectedRevision: 3 })
    expect(result.dashboard.id).toBe('dash-1')
    expect(result.version.kind).toBe('published')
    const request = requestOf(fetch)
    expect(request.method).toBe('POST')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1/publish')
    expect(request.body).toEqual({ expectedRevision: 3 })
  })

  it('delete() resolves undefined on 204', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    await expect(managementWith(fetch).context.dashboards.delete('dash-1')).resolves.toBeUndefined()
    const request = requestOf(fetch)
    expect(request.method).toBe('DELETE')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1')
  })

  it('listVersions() unwraps versions', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ versions: [{ uid: 'ver-1', kind: 'published' }] }))
    const versions = await managementWith(fetch).context.dashboards.listVersions('dash-1')
    expect(versions[0]?.uid).toBe('ver-1')
    const request = requestOf(fetch)
    expect(request.method).toBe('GET')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1/versions')
  })

  it('getVersion() fetches one version as a dashboard', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(DASHBOARD))
    const dashboard = await managementWith(fetch).context.dashboards.getVersion('dash-1', 'ver-1')
    expect(dashboard.id).toBe('dash-1')
    const request = requestOf(fetch)
    expect(request.method).toBe('GET')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1/versions/ver-1')
  })

  it('restoreVersion() posts to restore', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(DASHBOARD, 201))
    await managementWith(fetch).context.dashboards.restoreVersion('dash-1', 'ver-1')
    const request = requestOf(fetch)
    expect(request.method).toBe('POST')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1/versions/ver-1/restore')
    expect(request.body).toBeUndefined()
  })

  it('listDraftSnapshots() unwraps snapshots', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({ snapshots: [{ uid: 'snap-1', createdByUserId: 'user-1', createdAt: '2026-09-16T10:00:00.000Z' }] }),
    )
    const snapshots = await managementWith(fetch).context.dashboards.listDraftSnapshots('dash-1')
    expect(snapshots[0]?.uid).toBe('snap-1')
    const request = requestOf(fetch)
    expect(request.method).toBe('GET')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1/draft-snapshots')
  })

  it('updateAccess() sends the whole access body', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(DASHBOARD))
    const input = {
      visibility: 'shared' as const,
      groupPermissions: { 'group-1': { use: true, manage: false } },
      sharedWith: [{ email: 'ana@example.com', permission: 'use' as const }],
    }
    await managementWith(fetch).context.dashboards.updateAccess('dash-1', input)
    const request = requestOf(fetch)
    expect(request.method).toBe('PATCH')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1/access')
    expect(request.body).toEqual(input)
  })

  it('requestOwnershipTransfer() posts the new owner', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(DASHBOARD, 201))
    await managementWith(fetch).context.dashboards.requestOwnershipTransfer('dash-1', { newOwnerUserId: 'user-2' })
    const request = requestOf(fetch)
    expect(request.method).toBe('POST')
    expect(request.url).toMatch(/\/api\/v1\/context\/dashboards\/dash-1\/transfer-ownership$/)
    expect(request.body).toEqual({ newOwnerUserId: 'user-2' })
  })

  it('acceptOwnershipTransfer() posts to accept', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(DASHBOARD, 201))
    await managementWith(fetch).context.dashboards.acceptOwnershipTransfer('dash-1')
    const request = requestOf(fetch)
    expect(request.method).toBe('POST')
    expect(request.url).toContain('/api/v1/context/dashboards/dash-1/transfer-ownership/accept')
    expect(request.body).toBeUndefined()
  })

  it('cancelOwnershipTransfer() is a DELETE', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(DASHBOARD))
    const dashboard = await managementWith(fetch).context.dashboards.cancelOwnershipTransfer('dash-1')
    expect(dashboard.id).toBe('dash-1')
    const request = requestOf(fetch)
    expect(request.method).toBe('DELETE')
    expect(request.url).toMatch(/\/api\/v1\/context\/dashboards\/dash-1\/transfer-ownership$/)
  })

  it('rejects blank ids before any request', async () => {
    const fetch = vi.fn()
    const dashboards = managementWith(fetch).context.dashboards
    await expect(dashboards.get(' ')).rejects.toThrow(/dashboardId/)
    await expect(dashboards.delete('')).rejects.toThrow(/dashboardId/)
    await expect(dashboards.publish('', { expectedRevision: 1 })).rejects.toThrow(/dashboardId/)
    await expect(dashboards.getVersion('dash-1', '')).rejects.toThrow(/versionId/)
    await expect(dashboards.restoreVersion('dash-1', ' ')).rejects.toThrow(/versionId/)
    await expect(dashboards.cancelOwnershipTransfer('')).rejects.toThrow(/dashboardId/)
    expect(fetch).not.toHaveBeenCalled()
  })
})
