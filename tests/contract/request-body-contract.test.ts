import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  REUSES_BASE_REQUEST_BODY,
  SDK_REQUEST_BODY_FIELDS,
} from '../../contract/write-body-fields.js'
import {
  loadOpenApi,
  operationHasRequestBody,
  requestBodyProperties,
} from './openapi-spec.js'

const SURFACE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../sdk-surface.json',
)
const surface = JSON.parse(readFileSync(SURFACE_PATH, 'utf8')) as {
  operations: Record<string, { mode: string }>
}
const operations = Object.fromEntries(
  Object.entries(surface.operations).filter(([, row]) => row.mode !== 'excluded'),
)
const openapi = loadOpenApi()

describe('request body contract', () => {
  for (const operationId of Object.keys(SDK_REQUEST_BODY_FIELDS).sort()) {
    it(`${operationId} SDK fields are subset of OpenAPI schema`, () => {
      const sdkFields = new Set(SDK_REQUEST_BODY_FIELDS[operationId])
      const specFields = requestBodyProperties(openapi, operationId)
      const extra = [...sdkFields].filter((f) => !specFields.has(f))
      expect(extra).toEqual([])
    })
  }

  it('every mapped write endpoint with a body has a contract entry', () => {
    const missing = Object.keys(operations).filter(
      (oid) =>
        operationHasRequestBody(openapi, oid) &&
        !(oid in SDK_REQUEST_BODY_FIELDS) &&
        !REUSES_BASE_REQUEST_BODY.has(oid),
    )
    expect(missing).toEqual([])
  })
})
