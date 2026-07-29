import { describe, expect, it } from 'vitest'
import { Modus } from '../src/index.js'
import { createModusConfig, formatConfigForLog } from '../src/_config.js'

const TEST_KEY = 'modus_test_key_12345'

describe('config', () => {
  it('masks api key in toString', () => {
    const client = new Modus({ apiKey: 'modus_supersecrettoken123' })
    const repr = client.toString()
    expect(repr).not.toContain('supersecrettoken123')
    expect(repr).toContain('modus_')
    expect(repr).toContain('***')
  })

  it('shows base url', () => {
    const cfg = createModusConfig({ apiKey: TEST_KEY, baseUrl: 'http://localhost:3080' })
    expect(formatConfigForLog(cfg)).toContain('localhost:3080')
  })

  it('strips trailing slash from baseUrl', () => {
    const cfg = createModusConfig({ apiKey: TEST_KEY, baseUrl: 'https://api.getmodus.com/' })
    expect(cfg.baseUrl).toBe('https://api.getmodus.com')
  })

  it('defaults agentHost to production agent origin', () => {
    const cfg = createModusConfig({ apiKey: TEST_KEY })
    expect(cfg.agentHost).toBe('https://agent.getmodus.com')
    expect(cfg.baseUrls['agent-service']).toBe('https://agent.getmodus.com')
  })

  it('derives staging agentHost from api.<env>.getmodus.com baseUrl', () => {
    const cfg = createModusConfig({
      apiKey: TEST_KEY,
      baseUrl: 'https://api.staging.getmodus.com',
    })
    expect(cfg.agentHost).toBe('https://agent.staging.getmodus.com')
  })

  it('does not derive agentHost from non-api baseUrl (keeps prod default)', () => {
    const cfg = createModusConfig({
      apiKey: TEST_KEY,
      baseUrl: 'http://localhost:3040',
    })
    expect(cfg.agentHost).toBe('https://agent.getmodus.com')
  })

  it('does not derive agentHost from custom api.* hosts', () => {
    const cfg = createModusConfig({
      apiKey: TEST_KEY,
      baseUrl: 'https://api.attacker.example',
    })
    expect(cfg.agentHost).toBe('https://agent.getmodus.com')
  })

  it('normalizes service base URL overrides', () => {
    const cfg = createModusConfig({
      apiKey: TEST_KEY,
      baseUrls: { 'agent-service': 'http://localhost:3130/' },
    })
    expect(cfg.baseUrls['agent-service']).toBe('http://localhost:3130')
    expect(cfg.agentHost).toBe('http://localhost:3130')
  })

  it('rejects negative maxRetries', () => {
    expect(() => createModusConfig({ apiKey: TEST_KEY, maxRetries: -1 })).toThrow(/max_retries/)
  })
})
