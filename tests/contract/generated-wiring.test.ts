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
  return testCase.pagination ? { [testCase.pagination.items]: [], nextPageToken: '' } : {}
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
  if (testCase.exposure.body) args.push({})
  if ((testCase.exposure.query ?? []).length > 0) args.push(queryOptions(testCase))
  return args
}

function expectedPath(testCase: GeneratedCase): string {
  const bound = new Set(Object.keys(testCase.exposure.bind ?? {}))
  return OPERATIONS[testCase.operationId].path.replace(/\{([^}]+)\}/g, (_match, name: string) =>
    bound.has(name) ? BOUND_ID : PATH_ARG,
  )
}

/** The single exposed filter of a paginated exposure, for the page-2 and omission checks. */
function soleFilter(testCase: GeneratedCase): string {
  const query = testCase.exposure.query ?? []
  if (query.length !== 1) throw new Error(`${label(testCase)}: expected exactly one query param`)
  return query[0]
}

const paginated = cases.filter(
  (testCase) => testCase.pagination && (testCase.exposure.query ?? []).length === 1,
)

describe('generated resource wiring', () => {
  it('covers at least one generated exposure', () => {
    expect(cases.length).toBeGreaterThan(0)
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
    const unexpected = [...new URL(url).searchParams.keys()].filter((key) => !allowed.has(key))
    expect(unexpected, `query keys not in the spec: ${unexpected.join(', ')}`).toEqual([])
  })

  it.each(named(paginated))('%s keeps its filter on page 2', async (_name, testCase) => {
    const items = testCase.pagination!.items
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ [items]: [], nextPageToken: 'tok-2' }))
      .mockResolvedValueOnce(jsonResponse({ [items]: [], nextPageToken: '' }))
    const resource = client(testCase, fetch as unknown as typeof globalThis.fetch)
    const filter = soleFilter(testCase)

    const page = (await resource[testCase.exposure.method]({
      [filter]: QUERY_ARG,
    })) as Page<unknown>
    await page.getNextPage()

    const second = new URL(String((fetch.mock.calls[1] as [string, RequestInit])[0]))
    expect(second.searchParams.get(filter)).toBe(QUERY_ARG)
    expect(second.searchParams.get('pageToken')).toBe('tok-2')
  })

  it.each(named(paginated))('%s omits an unset optional filter', async (_name, testCase) => {
    const items = testCase.pagination!.items
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ [items]: [], nextPageToken: '' }))
    const resource = client(testCase, fetch as unknown as typeof globalThis.fetch)

    await resource[testCase.exposure.method]()

    const url = new URL(String((fetch.mock.calls[0] as [string, RequestInit])[0]))
    expect(url.searchParams.has(soleFilter(testCase))).toBe(false)
    expect(url.searchParams.get('pageSize')).toBe('25')
  })
})
