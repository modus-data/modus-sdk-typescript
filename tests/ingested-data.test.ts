import { describe, expect, it, vi } from 'vitest'
import { ConflictError, Modus } from '../src/index.js'

const BASE = 'https://api.getmodus.com'
const TEST_KEY = 'modus_test_key_ingested_data'

describe('Modus.ingestedData', () => {
  it('uploads an HTTP request while preserving exact strings and wire field names', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          checksum: 'a'.repeat(64),
          key: `org_test/generic/${'a'.repeat(64)}.json`,
          created: true,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })

    const result = await client.ingestedData.upload({
      integrationType: 'generic',
      request: {
        type: 'http',
        uri: 'https://example.com/שלום?q=%20',
        method: 'PATCH',
        body: '',
      },
      response: { format: 'text', content: 'line 1\r\nשלום\r\n' },
    })

    expect(result).toEqual({
      checksum: 'a'.repeat(64),
      key: `org_test/generic/${'a'.repeat(64)}.json`,
      created: true,
    })
    expect(String(fetch.mock.calls[0]?.[0])).toBe(`${BASE}/api/v1/ingested-data`)
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      integration_type: 'generic',
      request: {
        type: 'http',
        uri: 'https://example.com/שלום?q=%20',
        method: 'PATCH',
        body: '',
      },
      response: { format: 'text', content: 'line 1\r\nשלום\r\n' },
    })
  })

  it('surfaces an identical SQL upload as the standard ConflictError', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 409, message: 'Identical ingested data already exists' },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })

    await expect(
      client.ingestedData.upload({
        integrationType: 'generic',
        request: { type: 'sql', query: 'SELECT 1' },
        response: { format: 'csv', content: '' },
      }),
    ).rejects.toBeInstanceOf(ConflictError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
