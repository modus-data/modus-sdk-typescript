import { describe, expect, it, vi } from 'vitest'
import { ValidationError } from '../src/_exceptions.js'
import { Modus } from '../src/index.js'
import { ModusManagement } from '../src/management/index.js'

// URL normalisation drops dot segments and Express routes a trailing slash to the
// list route, so these ids silently targeted another resource:
// `memories(7).delete('..')` sent DELETE /api/v1/scopes/7 and deleted the scope.
const BAD_IDS = ['', '  ', '.', '..']
const options = { apiKey: 'modus_test_key_path', baseUrl: 'https://api.getmodus.com', maxRetries: 0 }

describe.each(BAD_IDS)('path id %j is rejected before any request', (bad) => {
  it('GET context.items.get', async () => {
    const fetch = vi.fn()
    await expect(new Modus({ ...options, fetch }).context.items.get(bad)).rejects.toThrow(
      ValidationError,
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('DELETE scopes.memories(7).delete', async () => {
    const fetch = vi.fn()
    await expect(
      new ModusManagement({ ...options, fetch }).scopes.memories(7).delete(bad),
    ).rejects.toThrow(ValidationError)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe.each(['.', '..'])('chat threadId %j is rejected before any request', (bad) => {
  it('POST scopes.chat', async () => {
    const fetch = vi.fn()
    await expect(
      new Modus({ ...options, fetch }).scopes.chat(7, 'hi', {
        model: 'claude-sonnet-5',
        threadId: bad,
      }),
    ).rejects.toThrow(ValidationError)
    expect(fetch).not.toHaveBeenCalled()
  })
})
