import { afterEach, describe, expect, it } from 'vitest'
import { authHeaders, resolveApiKey } from '../src/_auth.js'
import { AuthenticationError } from '../src/_exceptions.js'

const ENV_KEY = 'MODUS_API_KEY'

describe('auth', () => {
  afterEach(() => {
    delete process.env[ENV_KEY]
  })

  it('resolves from argument', () => {
    expect(resolveApiKey('modus_abc123')).toBe('modus_abc123')
  })

  it('resolves from env', () => {
    process.env[ENV_KEY] = 'modus_fromenv'
    expect(resolveApiKey()).toBe('modus_fromenv')
  })

  it('argument takes precedence over env', () => {
    process.env[ENV_KEY] = 'modus_fromenv'
    expect(resolveApiKey('modus_fromarg')).toBe('modus_fromarg')
  })

  it('missing key raises', () => {
    expect(() => resolveApiKey()).toThrow(AuthenticationError)
    expect(() => resolveApiKey()).toThrow(/No API key provided/)
  })

  it('wrong prefix raises without leaking key', () => {
    const badKey = 'sk-openai-wrong'
    expect(() => resolveApiKey(badKey)).toThrow(AuthenticationError)
    try {
      resolveApiKey(badKey)
    } catch (error) {
      expect(String(error)).not.toContain(badKey)
    }
  })

  it('auth headers format', () => {
    expect(authHeaders('modus_mykey')).toEqual({ Authorization: 'Bearer modus_mykey' })
  })
})
