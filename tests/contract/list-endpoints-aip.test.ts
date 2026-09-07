import { describe, expect, it, vi } from 'vitest'
import { Page } from '../../src/_pagination.js'
import { ModusError } from '../../src/_exceptions.js'
import { Modus } from '../../src/index.js'
import { ModusManagement } from '../../src/management/index.js'
import {
  FORBIDDEN_QUERY_PARAMS,
  REJECTED_LIST_RESPONSE_BODY,
  SDK_AIP_LIST_OPERATIONS,
  successBody,
  wrongKeyBody,
} from './list-operations.js'

const TEST_BASE = 'https://api.example.test'
const TEST_KEY = 'modus_test_key_list_aip'

function mockFetchForUrl(
  urlSuffix: string,
  body: Record<string, unknown>,
): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes(urlSuffix)) {
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response('not found', { status: 404 })
  })
}

function clients(fetch: ReturnType<typeof vi.fn>) {
  const opts = { apiKey: TEST_KEY, baseUrl: TEST_BASE, maxRetries: 0, fetch }
  return {
    modus: new Modus(opts),
    mgmt: new ModusManagement(opts),
  }
}

describe('list endpoints AIP-158', () => {
  for (const spec of SDK_AIP_LIST_OPERATIONS) {
    const id = `${spec.operationId}:${spec.clientKind}`

    it(`${id} parses AIP success response`, async () => {
      const fetch = mockFetchForUrl(spec.mockUrlSuffix, successBody(spec))
      const { modus, mgmt } = clients(fetch)
      const client = spec.clientKind === 'management' ? mgmt : modus
      const page = (await spec.invoke(client)) as Page<unknown>
      expect(page).toBeInstanceOf(Page)
      expect(page.items).toHaveLength(1)
    })

    it(`${id} rejects non-AIP response body`, async () => {
      const fetch = mockFetchForUrl(spec.mockUrlSuffix, REJECTED_LIST_RESPONSE_BODY)
      const { modus, mgmt } = clients(fetch)
      const client = spec.clientKind === 'management' ? mgmt : modus
      await expect(spec.invoke(client)).rejects.toThrow(ModusError)
    })

    it(`${id} rejects wrong plural key`, async () => {
      const fetch = mockFetchForUrl(spec.mockUrlSuffix, wrongKeyBody(spec))
      const { modus, mgmt } = clients(fetch)
      const client = spec.clientKind === 'management' ? mgmt : modus
      await expect(spec.invoke(client)).rejects.toThrow(ModusError)
    })

    it(`${id} sends AIP query params only`, async () => {
      const fetch = mockFetchForUrl(spec.mockUrlSuffix, successBody(spec))
      const { modus, mgmt } = clients(fetch)
      const client = spec.clientKind === 'management' ? mgmt : modus
      await spec.invoke(client)
      expect(fetch).toHaveBeenCalled()
      const url = new URL(String(fetch.mock.calls[0]?.[0]))
      expect(url.searchParams.get('pageSize')).toBe(String(spec.expectedPageSize ?? 25))
      expect(url.searchParams.get('pageToken')).toBe('tok_abc')
      const keys = new Set(url.searchParams.keys())
      for (const forbidden of FORBIDDEN_QUERY_PARAMS) {
        expect(keys.has(forbidden)).toBe(false)
      }
    })
  }
})
