import { describe, expect, it, vi } from 'vitest'
import { createModusConfig } from '../src/_config.js'
import { getOperation, invokeOperation } from '../src/_openapi-invoke.js'
import type { HttpClient } from '../src/_http.js'

function mockHttp(config: ReturnType<typeof createModusConfig>): HttpClient {
  return {
    config,
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(null),
  } as unknown as HttpClient
}

describe('openapi invoke', () => {
  it('getOperation returns known op', () => {
    const op = getOperation('ScopesController_list')
    expect(op.method).toBe('GET')
    expect(op.path).toContain('scopes')
  })

  it('getOperation throws for unknown op', () => {
    expect(() => getOperation('NotARealOperation')).toThrow(/Unknown API operation/)
  })

  it('invokeOperation GET with query', async () => {
    const http = mockHttp(
      createModusConfig({ apiKey: 'modus_org_prefix_secret', baseUrl: 'https://api.example.com' }),
    )
    await invokeOperation(http, 'ScopesController_list', {
      query: { pageSize: 25 },
    })
    expect(http.get).toHaveBeenCalledWith('/api/v1/scopes', { pageSize: 25 }, {
      baseUrl: 'https://api.example.com',
      headers: undefined,
    })
  })

  it('invokeOperation POST with path params', async () => {
    const http = mockHttp(createModusConfig({ apiKey: 'modus_org_prefix_secret' }))
    await invokeOperation(http, 'ScopesController_create', {
      jsonBody: { name: 'x' },
    })
    expect(http.post).toHaveBeenCalledWith('/api/v1/scopes', { name: 'x' }, {
      baseUrl: 'https://api.getmodus.com',
      headers: undefined,
    })
  })

  it('invokeOperation PATCH substitutes path params', async () => {
    const http = mockHttp(createModusConfig({ apiKey: 'modus_org_prefix_secret' }))
    await invokeOperation(http, 'ScopesController_update', {
      pathParams: { id: 'abc/def' },
      jsonBody: { name: 'y' },
      query: { updateMask: 'name' },
    })
    expect(http.patch).toHaveBeenCalledWith(
      '/api/v1/scopes/abc%2Fdef',
      { name: 'y' },
      { updateMask: 'name' },
      { baseUrl: 'https://api.getmodus.com', headers: undefined },
    )
  })

  it('routes non-api operations to their generated service URL', async () => {
    const http = mockHttp(createModusConfig({ apiKey: 'modus_org_prefix_secret' }))
    await invokeOperation(http, 'WorkflowRunsController_create', {
      pathParams: { id: 123 },
      jsonBody: { organizationId: 'org_123' },
    })
    expect(http.post).toHaveBeenCalledWith(
      '/agent/v1/workflows/123/runs',
      { organizationId: 'org_123' },
      {
        baseUrl: 'https://agent.getmodus.com',
        headers: undefined,
      },
    )
  })

  it('lets callers override non-api service URLs', async () => {
    const http = mockHttp(
      createModusConfig({
        apiKey: 'modus_org_prefix_secret',
        baseUrls: { 'agent-service': 'http://localhost:3130/' },
      }),
    )
    await invokeOperation(http, 'WorkflowRunsController_create', {
      pathParams: { id: 123 },
      jsonBody: { organizationId: 'org_123' },
    })
    expect(http.post).toHaveBeenCalledWith(
      '/agent/v1/workflows/123/runs',
      { organizationId: 'org_123' },
      {
        baseUrl: 'http://localhost:3130',
        headers: undefined,
      },
    )
  })

  it('invokeOperation PUT for supervision.set', async () => {
    const http = mockHttp(createModusConfig({ apiKey: 'modus_org_prefix_secret' }))
    await invokeOperation(http, 'ScopeSupervisionController_set', {
      pathParams: { id: 42 },
      jsonBody: { supervisorAgentId: 7 },
    })
    expect(http.put).toHaveBeenCalledWith(
      '/api/v1/scopes/42/supervision',
      { supervisorAgentId: 7 },
      { baseUrl: 'https://api.getmodus.com', headers: undefined },
    )
  })

  it('agentHost / MODUS_AGENT_HOST wins over generated agent.modus.com serverUrl', async () => {
    const http = mockHttp(
      createModusConfig({
        apiKey: 'modus_org_prefix_secret',
        agentHost: 'https://agent.staging.getmodus.com',
      }),
    )
    await invokeOperation(http, 'RunLifecycleController_active', {
      query: { pageSize: 10 },
    })
    expect(http.get).toHaveBeenCalledWith(
      '/agent/v1/runs/active',
      { pageSize: 10 },
      {
        baseUrl: 'https://agent.staging.getmodus.com',
        headers: undefined,
      },
    )
  })
})
