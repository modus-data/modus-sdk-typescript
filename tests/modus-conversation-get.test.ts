import { describe, expect, it, vi } from 'vitest'
import { Modus } from '../src/index.js'

const conversation = {
  threadId: 'thread-1', scopeId: 0,
  messages: [{ type: 'human', content: 'Hello' }],
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

describe('modus.conversations.get', () => {
  it.each([[conversation], [null], [[]], [42]])('preserves the raw response: %j', async (body) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    const client = new Modus({ apiKey: 'modus_test_key', maxRetries: 0, fetch })

    await expect(client.modus.conversations.get('thread-1')).resolves.toEqual(body)
  })

  it('rejects an empty thread ID before HTTP', async () => {
    const fetch = vi.fn()
    const client = new Modus({ apiKey: 'modus_test_key', maxRetries: 0, fetch })

    await expect(client.modus.conversations.get('')).rejects.toThrow('thread_id')
    expect(fetch).not.toHaveBeenCalled()
  })
})
