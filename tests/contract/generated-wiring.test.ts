import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { QUERY_ARG_TYPES, specDocs } from '../../../scripts/emit-sdk-resources.mjs'
import { OPERATIONS, type OperationId } from '../../src/_generated/operations.js'
import { Modus } from '../../src/index.js'
import { ValidationError } from '../../src/_exceptions.js'
import { ModusManagement } from '../../src/management/index.js'
import type { Page } from '../../src/_pagination.js'

const CLIENTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const SURFACE_PATH = join(CLIENTS_DIR, 'sdk-surface.json')
const SPEC_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/_generated/public-openapi.json',
)
const BASE = 'https://api.test'
const TEST_KEY = 'modus_x'
const BOUND_ID = '1'
const PATH_ARG = 'p-1'

type QueryArgument = string | number | boolean

/** The value a query argument takes, per OpenAPI scalar; one per key of `QUERY_ARG_TYPES`. */
const QUERY_SAMPLES: Record<string, QueryArgument> = {
  string: 'q',
  integer: 7,
  number: 1.5,
  boolean: true,
}

/** Resolved parameter schemas per operation, from the same derivation the emitter uses. */
const docsByOperation = specDocs(JSON.parse(readFileSync(SPEC_PATH, 'utf8'))) as Record<
  string,
  { schemas: Record<string, { type?: string } | null> }
>

/** The argument a query parameter is called with, chosen by the scalar the spec gives it. */
function querySample(operationId: string, name: string): QueryArgument {
  const type = docsByOperation[operationId]?.schemas?.[name]?.type
  const sample = type ? QUERY_SAMPLES[type] : undefined
  if (sample === undefined) {
    throw new Error(`${operationId}: no wire sample for query parameter "${name}" (${type})`)
  }
  return sample
}

/**
 * Minimal valid payloads for the body and return types a generated exposure names. A new
 * generated type without an entry fails `every generated type has a sample`. Kept in step
 * with the Python wiring test's `_SAMPLES`.
 */
const SAMPLES: Record<string, Record<string, unknown>> = {
  Conversation: {
    threadId: 'thread-1', scopeId: 0, messages: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
  "Dashboard": {
    "id": "dash-1",
    "contextItemId": "ci-1",
    "title": "Revenue",
    "description": "",
    "access": {
      "visibility": "private",
      "groupPermissions": {},
      "sharedWith": [
        {
          "email": "ana@example.com",
          "userId": "user_2",
          "permission": "use"
        }
      ],
      "ownerUserId": "user_1",
      "ownerEmail": "owner@example.com"
    },
    "definition": {
      "tiles": [
        {
          "id": "tile-1",
          "title": "Revenue",
          "kind": "kpi",
          "connectionId": "conn-1",
          "sql": "select sum(amount) from orders",
          "config": {}
        }
      ],
      "filters": [
        {
          "id": "region",
          "label": "Region",
          "type": "string_list",
          "required": true,
          "quotation": "single",
          "defaultValue": [
            "EMEA"
          ]
        }
      ],
      "layout": {
        "elements": {
          "tile-1": {
            "x": 0,
            "y": 0,
            "w": 4,
            "h": 2
          }
        }
      }
    },
    "view": "draft",
    "selectedVersion": {
      "id": null,
      "versionNumber": null,
      "createdByUserId": "user_1",
      "createdAt": "2026-09-16T10:00:00.000Z",
      "access": {
        "visibility": "private",
        "groupPermissions": {},
        "sharedWith": [
          {
            "email": "ana@example.com",
            "userId": "user_2",
            "permission": "use"
          }
        ],
        "ownerUserId": "user_1",
        "ownerEmail": "owner@example.com"
      }
    },
    "draftRevision": 4,
    "activeVersionId": null,
    "updatedByUserId": "user_1",
    "createdAt": "2026-09-16T10:00:00.000Z",
    "updatedAt": "2026-09-16T10:05:00.000Z",
    "pendingOwnershipTransfer": null,
    "canUse": true,
    "canManage": true
  },
  "DashboardElementsList": {
    "dashboardId": "dash-1",
    "draftRevision": 3,
    "elements": []
  },
  "DashboardElementResult": {
    "dashboardId": "dash-1",
    "draftRevision": 3,
    "element": {
      "id": "tile-1",
      "kind": "kpi",
      "title": "Revenue",
      "layout": {
        "x": 0,
        "y": 0,
        "w": 4,
        "h": 2
      },
      "connectionId": "conn-1",
      "sql": "select sum(amount) from orders",
      "format": null
    }
  },
  "DashboardVersion": {
    "uid": "v-1",
    "dashboardUid": "dash-1",
    "versionNumber": 1,
    "kind": "published",
    "title": "Revenue",
    "description": "",
    "access": {
      "visibility": "private",
      "groupPermissions": {},
      "sharedWith": [
        {
          "email": "ana@example.com",
          "userId": "user_2",
          "permission": "use"
        }
      ],
      "ownerUserId": "user_1",
      "ownerEmail": "owner@example.com"
    },
    "definition": {},
    "createdByUserId": "user_1",
    "createdAt": "2026-09-16T10:00:00.000Z"
  },
  "DashboardDraftSnapshot": {
    "uid": "snap-1",
    "createdByUserId": "user_1",
    "createdAt": "2026-09-16T10:00:00.000Z"
  },
  "FileUpload": {
    "uploadId": "up-1",
    "status": "processing"
  },
  Workflow: { id: 5, name: 'Weekly report', type: 'task', status: 'active' },
  AgentInterface: {
    id: 'int_1', agentId: 42, type: 'mcp', name: 'Internal', config: {},
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  },
  ScopeInterface: {"id": "if-1", "scopeId": 1, "type": "slack", "name": "Slack", "config": {"accessMode": "all"}, "createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z"},
  Supervision: {"supervisorAgentId": 1, "subordinateAgentIds": [2]},
  SetSupervisionRequest: {"subordinateAgentIds": [2]},
  EvaluationConfig: {"enabled": false, "notifications": {"recipients": [], "channels": {"email": false}}},
  UpdateEvaluationConfig: {"enabled": true},
  TriggerEvaluationRunResponse: {"runId": "run-1"},
  EvaluationRunWithResults: {"id": "run-1", "skillId": 1, "trigger": "manual", "status": "completed", "startedAt": "2026-01-01T00:00:00Z", "totalCases": 0, "passedCases": 0, "failedCases": 0, "isRegression": false, "results": []},
  Scope: { id: 1, name: 'Probe', status: 'active' },
  Memory: { id: 'mem_01', memory: 'User prefers bullet points.' },
  MemorySearchRequest: { query: 'revenue preferences' },
  MemorySearchResult: { memories: [] },
  MemoryUpdate: { memory: 'Updated text.' },
  UsageUsersReport: { users: [] },
}

interface Exposure {
  surface: 'consumption' | 'management'
  resource: string[]
  bind?: Record<string, string>
  method: string
  query?: (string | { name: string; ts: string; py: string })[]
  body?: { arg: string; type: string }
  pageSize?: { default?: number; max?: number }
  emptyBody?: boolean
  unwrap?: string
  returns?: string
}

interface Operation {
  mode: 'custom' | 'generated' | 'excluded'
  exposures?: Exposure[]
  pagination?: { items: string }
}

interface GeneratedCase {
  operationId: OperationId
  exposure: Exposure
  pagination?: { items: string }
}

const surface = JSON.parse(readFileSync(SURFACE_PATH, 'utf8')) as {
  operations: Record<string, Operation>
}

const cases: GeneratedCase[] = Object.entries(surface.operations).flatMap(([operationId, op]) =>
  op.mode === 'generated'
    ? (op.exposures ?? []).map((exposure) => ({
        operationId: operationId as OperationId,
        exposure,
        pagination: op.pagination,
      }))
    : [],
)

function label(testCase: GeneratedCase): string {
  const { surface: client, resource, method } = testCase.exposure
  return `${testCase.operationId} → ${client}.${resource.join('.')}.${method}`
}

function named(subset: GeneratedCase[]): [string, GeneratedCase][] {
  return subset.map((testCase) => [label(testCase), testCase])
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function responseBody(testCase: GeneratedCase): unknown {
  if (testCase.pagination) return { [testCase.pagination.items]: [], nextPageToken: '' }
  const returns = testCase.exposure.returns
  const value = returns ? SAMPLES[returns] : {}
  return testCase.exposure.unwrap ? { [testCase.exposure.unwrap]: [value] } : value
}

type Resource = Record<string, (...args: unknown[]) => Promise<unknown>>

function client(testCase: GeneratedCase, fetch: typeof globalThis.fetch): Resource {
  const options = { apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch }
  const root = (
    testCase.exposure.surface === 'consumption'
      ? new Modus(options)
      : new ModusManagement(options)
  ) as unknown as Record<string, unknown>

  let target: Record<string, unknown> = root
  for (const [index, name] of testCase.exposure.resource.entries()) {
    const parent = target
    const next = parent[name]
    const isLast = index === testCase.exposure.resource.length - 1
    target =
      testCase.exposure.bind && isLast
        ? ((next as (id: string) => Record<string, unknown>).call(parent, BOUND_ID) as Record<
            string,
            unknown
          >)
        : (next as Record<string, unknown>)
  }
  return target as unknown as Resource
}

/** Path args the method takes positionally: every path param the exposure does not bind. */
function positionalPathParams(testCase: GeneratedCase): readonly string[] {
  const bound = new Set(Object.keys(testCase.exposure.bind ?? {}))
  return OPERATIONS[testCase.operationId].pathParams.filter((name) => !bound.has(name))
}

function queryOptions(testCase: GeneratedCase): Record<string, QueryArgument> {
  return Object.fromEntries(
    filters(testCase).map((name) => [
      name,
      querySample(testCase.operationId, name),
    ]),
  )
}

function callArgs(testCase: GeneratedCase): unknown[] {
  if (testCase.pagination) return [queryOptions(testCase)]
  const args: unknown[] = positionalPathParams(testCase).map(() => PATH_ARG)
  const body = testCase.exposure.body
  if (body) args.push(structuredClone(SAMPLES[body.type]))
  if ((testCase.exposure.query ?? []).length > 0) args.push(queryOptions(testCase))
  return args
}

function expectedPath(testCase: GeneratedCase): string {
  const bound = new Set(Object.keys(testCase.exposure.bind ?? {}))
  return OPERATIONS[testCase.operationId].path.replace(/\{([^}]+)\}/g, (_match, name: string) =>
    bound.has(name) ? BOUND_ID : PATH_ARG,
  )
}

/** The query string a sampled argument must serialise to. */
function wireValue(operationId: string, name: string): string {
  return String(querySample(operationId, name))
}

/** The exposed filters of a paginated exposure, for the page-2 and omission checks. */
function filters(testCase: GeneratedCase): readonly string[] {
  return (testCase.exposure.query ?? []).map((entry) => typeof entry === 'string' ? entry : entry.name)
}

function requestQuery(fetch: ReturnType<typeof vi.fn>, index: number): URLSearchParams {
  return new URL(String((fetch.mock.calls[index] as [string, RequestInit])[0])).searchParams
}

const paginated = cases.filter((testCase) => testCase.pagination)

describe('generated resource wiring', () => {
  it('covers at least one generated exposure', () => {
    expect(cases.length).toBeGreaterThan(0)
  })

  it('every generated type has a sample', () => {
    const needed = new Set(
      cases.flatMap((testCase) =>
        [
          testCase.exposure.body?.type,
          testCase.pagination ? undefined : testCase.exposure.returns,
        ].filter((name): name is string => Boolean(name)),
      ),
    )
    const missing = [...needed].filter((name) => !(name in SAMPLES)).sort()
    expect(missing, `Add a sample payload for: ${missing.join(', ')}`).toEqual([])
  })

  it('every query scalar the emitter accepts has a wire sample', () => {
    const missing = Object.keys(QUERY_ARG_TYPES).filter((scalar) => !(scalar in QUERY_SAMPLES))
    expect(missing, `Add a query sample for: ${missing.join(', ')}`).toEqual([])
  })

  it('samples a query argument from the scalar the spec gives the parameter', () => {
    expect(querySample('ConnectionsController_list', 'type')).toBe('q')
    expect(querySample('ConnectionsController_list', 'pageSize')).toBe(1.5)
    // A $ref parameter schema resolves before the scalar is read.
    expect(querySample('DashboardsController_list', 'view')).toBe('q')
  })

  it.each(named(cases))('%s is inherited from a generated base', (_name, testCase) => {
    const resource = client(testCase, vi.fn())
    expect(Object.hasOwn(Object.getPrototypeOf(resource) as object, testCase.exposure.method)).toBe(
      false,
    )
  })

  it.each(named(cases))('%s calls the spec method, path and query', async (_name, testCase) => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(responseBody(testCase)))
    const resource = client(testCase, fetch as unknown as typeof globalThis.fetch)

    await resource[testCase.exposure.method](...callArgs(testCase))

    const spec = OPERATIONS[testCase.operationId]
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect((init.method ?? '').toUpperCase()).toBe(spec.method)
    expect(new URL(url).pathname).toBe(expectedPath(testCase))
    const allowed = new Set<string>(spec.queryParams)
    const sent = new URL(url).searchParams
    const unexpected = [...sent.keys()].filter((key) => !allowed.has(key))
    expect(unexpected, `query keys not in the spec: ${unexpected.join(', ')}`).toEqual([])
    for (const name of filters(testCase)) {
      expect(sent.get(name), `${name} not forwarded`).toBe(wireValue(testCase.operationId, name))
    }
    if (testCase.exposure.emptyBody) expect(JSON.parse(String(init.body))).toEqual({})
    const body = testCase.exposure.body
    if (body) {
      expect(JSON.parse(String(init.body)), 'body not forwarded').toEqual(SAMPLES[body.type])
    }
  })

  it.each(named(paginated))('%s keeps every filter on page 2', async (_name, testCase) => {
    const items = testCase.pagination!.items
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ [items]: [], nextPageToken: 'tok-2' }))
      .mockResolvedValueOnce(jsonResponse({ [items]: [], nextPageToken: '' }))
    const resource = client(testCase, fetch as unknown as typeof globalThis.fetch)

    const page = (await resource[testCase.exposure.method](queryOptions(testCase))) as Page<unknown>
    await page.getNextPage()

    for (const [index, where] of [
      [0, 'page 1'],
      [1, 'page 2'],
    ] as const) {
      for (const name of filters(testCase)) {
        expect(requestQuery(fetch, index).get(name), `${name} missing on ${where}`).toBe(
          wireValue(testCase.operationId, name),
        )
      }
    }
    expect(requestQuery(fetch, 1).get('pageToken')).toBe('tok-2')
  })

  it.each(named(paginated))('%s omits unset optional filters', async (_name, testCase) => {
    const items = testCase.pagination!.items
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ [items]: [], nextPageToken: '' }))
    const resource = client(testCase, fetch as unknown as typeof globalThis.fetch)

    await resource[testCase.exposure.method]()

    for (const name of filters(testCase)) {
      expect(requestQuery(fetch, 0).has(name), `${name} sent while unset`).toBe(false)
    }
    expect(requestQuery(fetch, 0).get('pageSize')).toBe(String(testCase.exposure.pageSize?.default ?? 25))
  })
})

describe('bound scope validation', () => {
  it.each(['interfaces', 'evaluations'] as const)('%s validates scope before the child identifier', async (resource) => {
    const fetch = vi.fn()
    const management = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const call = resource === 'interfaces'
      ? management.scopes.interfaces('').delete('')
      : management.scopes.evaluations('').getRun('')
    await expect(call).rejects.toThrow(/scope_id/)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('generated supervision write validation', () => {
  it.each(['set', 'setActive'] as const)('%s rejects unsupported undefined keys before HTTP', async (method) => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(SAMPLES.Supervision))
    const management = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const request = { subordinateAgentIds: [2], unsupportedField: undefined }

    await expect(management.scopes.supervision(1)[method](request)).rejects.toThrow(ValidationError)
    expect(fetch).not.toHaveBeenCalled()
    expect(Object.hasOwn(request, 'unsupportedField')).toBe(true)
  })
})

describe('generated writes that omit undefined before validation', () => {
  it.each(['memory update', 'memory search', 'evaluation update'] as const)('%s preserves optional fields', async (operation) => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({}))
    const management = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const body = operation === 'memory update'
      ? { memory: 'changed', extra: undefined }
      : operation === 'memory search'
        ? { query: 'preferences', extra: undefined }
        : { enabled: true, extra: undefined }
    const invoke = () => operation === 'memory update'
      ? management.scopes.memories(1).update('memory-1', body)
      : operation === 'memory search'
        ? management.scopes.memories(1).search(body as { query: string })
        : management.scopes.evaluations(1).updateConfig(body)

    await invoke()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual(
      operation === 'memory update' ? { memory: 'changed' }
        : operation === 'memory search' ? { query: 'preferences' } : { enabled: true },
    )
    expect(Object.hasOwn(body, 'extra')).toBe(true)
    Object.assign(body, { extra: 'unsupported' })
    await expect(invoke()).rejects.toThrow(ValidationError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
