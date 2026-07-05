import { describe, expect, it } from 'vitest'
import {
  FORBIDDEN_RESPONSE_KEYS,
  REJECTED_LIST_RESPONSE_BODY,
  SDK_AIP_LIST_OPERATIONS,
} from './list-operations.js'
import {
  listResponseArrayKeys,
  loadOpenApi,
  operationResponseSchemaName,
} from './openapi-spec.js'

const openapi = loadOpenApi()
const describeIfOpenApi = openapi ? describe : describe.skip

describeIfOpenApi('list response contract', () => {
  for (const spec of SDK_AIP_LIST_OPERATIONS) {
    const id = `${spec.operationId}:${spec.clientKind}`

    it(`${id} itemsKey matches OpenAPI response DTO`, () => {
      const schemaName = operationResponseSchemaName(openapi!, spec.operationId)
      const arrayKeys = listResponseArrayKeys(openapi!, schemaName)
      expect([...arrayKeys]).toEqual([spec.itemsKey])

      const schemas = (openapi!.components as { schemas: Record<string, Record<string, unknown>> })
        .schemas
      const schema = schemas[schemaName]!
      const props = schema.properties as Record<string, unknown>
      expect(props).toHaveProperty('nextPageToken')
    })

    it(`${id} itemsKey is not a forbidden plural`, () => {
      expect(FORBIDDEN_RESPONSE_KEYS.has(spec.itemsKey)).toBe(false)
    })
  }

  it('rejected fixture uses forbidden keys', () => {
    expect(REJECTED_LIST_RESPONSE_BODY).toHaveProperty('items')
    expect(REJECTED_LIST_RESPONSE_BODY).toHaveProperty('nextCursor')
  })
})
