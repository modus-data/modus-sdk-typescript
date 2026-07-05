import { describe, expect, it } from 'vitest'
import {
  REUSES_BASE_REQUEST_BODY,
  SDK_REQUEST_BODY_FIELDS,
} from '../../contract/write-body-fields.js'
import { OPERATIONS } from './operation_coverage.js'
import {
  loadOpenApi,
  operationHasRequestBody,
  requestBodyProperties,
} from './openapi-spec.js'

const openapi = loadOpenApi()
const describeIfOpenApi = openapi ? describe : describe.skip

describeIfOpenApi('request body contract', () => {
  for (const operationId of Object.keys(SDK_REQUEST_BODY_FIELDS).sort()) {
    it(`${operationId} SDK fields are subset of OpenAPI schema`, () => {
      const sdkFields = new Set(SDK_REQUEST_BODY_FIELDS[operationId])
      const specFields = requestBodyProperties(openapi!, operationId)
      const extra = [...sdkFields].filter((f) => !specFields.has(f))
      expect(extra).toEqual([])
    })
  }

  it('every mapped write endpoint with a body has a contract entry', () => {
    const missing = Object.keys(OPERATIONS).filter(
      (oid) =>
        operationHasRequestBody(openapi!, oid) &&
        !(oid in SDK_REQUEST_BODY_FIELDS) &&
        !REUSES_BASE_REQUEST_BODY.has(oid),
    )
    expect(missing).toEqual([])
  })
})
