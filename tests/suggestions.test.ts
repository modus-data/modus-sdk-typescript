import { describe, expect, it, vi } from 'vitest'
import { Modus } from '../src/index.js'

const TEST_KEY = 'modus_test_key_suggestions'
const BASE = 'https://api.modus.com'

describe('Modus.suggestions', () => {
  it('lists suggestion questions with scoped query params', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          suggestions: [
            {
              id: 'predefined:q1',
              skill_id: 42,
              label: 'Revenue',
              prompt: 'Show me revenue',
            },
          ],
          nextPageToken: null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const page = await client.suggestions.list({ pageSize: 5, skillIds: [7, 42] })
    expect(page.items[0]?.label).toBe('Revenue')
    const url = String(fetch.mock.calls[0]?.[0])
    expect(url).toContain('/api/v1/suggestions/questions')
    expect(url).toContain('pageSize=5')
    expect(url).toContain('skill_ids=7%2C42')
  })

  it('records suggestion events with snake_case body fields', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await client.suggestions.recordEvent('predefined:q1', {
      event_type: 'clicked',
      source: 'home',
      skill_id: 42,
      thread_id: 'thread-1',
      metadata: { placement: 'home' },
    })
    expect(String(fetch.mock.calls[0]?.[0])).toContain(
      '/api/v1/suggestions/questions/predefined%3Aq1/events',
    )
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      event_type: 'clicked',
      source: 'home',
      skill_id: 42,
      thread_id: 'thread-1',
      metadata: { placement: 'home' },
    })
  })
})
