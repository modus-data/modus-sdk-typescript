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
