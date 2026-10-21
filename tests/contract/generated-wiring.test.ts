import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { OPERATIONS, type OperationId } from '../../src/_generated/operations.js'
import { Modus } from '../../src/index.js'
import { ModusManagement } from '../../src/management/index.js'
import type { Page } from '../../src/_pagination.js'

const CLIENTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const SURFACE_PATH = join(CLIENTS_DIR, 'sdk-surface.json')
const BASE = 'https://api.test'
const TEST_KEY = 'modus_x'
const BOUND_ID = '1'
const PATH_ARG = 'p-1'
const QUERY_ARG = 'q'

/**
 * Minimal valid payloads for the body and return types a generated exposure names. A new
 * generated type without an entry fails `every generated type has a sample`. Kept in step
 * with the Python wiring test's `_SAMPLES`.
 */
const SAMPLES: Record<string, Record<string, unknown>> = {
  Memory: { id: 'mem_01', memory: 'User prefers bullet points.' },
  MemorySearchRequest: { query: 'revenue preferences' },
  MemorySearchResult: { memories: [] },
  MemoryUpdate: { memory: 'Updated text.' },
}

interface Exposure {
  surface: 'consumption' | 'management'
  resource: string[]
  bind?: Record<string, string>
  method: string
  query?: string[]
  body?: { arg: string; type: string }
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
  return returns ? SAMPLES[returns] : {}
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

function queryOptions(testCase: GeneratedCase): Record<string, string> {
  return Object.fromEntries((testCase.exposure.query ?? []).map((name) => [name, QUERY_ARG]))
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

/** The exposed filters of a paginated exposure, for the page-2 and omission checks. */
function filters(testCase: GeneratedCase): readonly string[] {
  return testCase.exposure.query ?? []
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
      expect(sent.get(name), `${name} not forwarded`).toBe(QUERY_ARG)
    }
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
        expect(requestQuery(fetch, index).get(name), `${name} missing on ${where}`).toBe(QUERY_ARG)
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
    expect(requestQuery(fetch, 0).get('pageSize')).toBe('25')
  })
})
