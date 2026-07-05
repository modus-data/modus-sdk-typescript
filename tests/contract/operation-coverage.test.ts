import { describe, expect, it } from 'vitest'
import { loadOpenApi } from './openapi-spec.js'
import { OPERATIONS } from './operation_coverage.js'

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete'])

function allOperationIds(openapi: Record<string, unknown>): Set<string> {
  const ids = new Set<string>()
  const paths = openapi.paths as Record<string, Record<string, unknown>> | undefined
  if (!paths) return ids
  for (const pathItem of Object.values(paths)) {
    for (const [method, op] of Object.entries(pathItem)) {
      if (
        HTTP_METHODS.has(method) &&
        op &&
        typeof op === 'object' &&
        typeof (op as { operationId?: unknown }).operationId === 'string'
      ) {
        ids.add((op as { operationId: string }).operationId)
      }
    }
  }
  return ids
}

const openapi = loadOpenApi()
const describeIfOpenApi = openapi ? describe : describe.skip

describeIfOpenApi('OpenAPI operation coverage', () => {
  it('maps every spec operation', () => {
    const specIds = allOperationIds(openapi!)
    const unmapped = [...specIds].filter((id) => !(id in OPERATIONS))
    expect(unmapped).toEqual([])
  })

  it('has no stale mappings', () => {
    const specIds = allOperationIds(openapi!)
    const stale = Object.keys(OPERATIONS).filter((id) => !specIds.has(id))
    expect(stale).toEqual([])
  })

  it('covers the full spec', () => {
    const specIds = allOperationIds(openapi!)
    expect(Object.keys(OPERATIONS).length).toBe(specIds.size)
  })
})

describe('OPERATIONS notes', () => {
  it('every entry has a non-empty note', () => {
    const blank = Object.entries(OPERATIONS)
      .filter(([, note]) => !note.trim())
      .map(([id]) => id)
    expect(blank).toEqual([])
  })
})
