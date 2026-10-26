import { afterEach, describe, expect, it, vi } from 'vitest'
import { InternalServerError, NotFoundError, RateLimitError } from '../src/_exceptions.js'
import { isRetrySafe, withRetry } from '../src/_retry.js'

describe('withRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('success without retry', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    await expect(withRetry(fn, 2)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('non-retryable raises immediately', async () => {
    const fn = vi.fn().mockRejectedValue(new NotFoundError('not found'))
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb) => {
      ;(cb as () => void)()
      return 0 as unknown as NodeJS.Timeout
    })
    await expect(withRetry(fn, 3)).rejects.toBeInstanceOf(NotFoundError)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries NotFound once when retryNotFoundOnDeploy is set', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb) => {
      ;(cb as () => void)()
      return 0 as unknown as NodeJS.Timeout
    })
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new NotFoundError('Skill not found'))
      .mockResolvedValueOnce('ok')

    await expect(withRetry(fn, 0, { retryNotFoundOnDeploy: true })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('a 5xx the transport marked not retryable (a POST) raises at once', async () => {
    const fn = vi.fn().mockRejectedValue(new InternalServerError('fail', 502, { retryable: false }))
    await expect(withRetry(fn, 2)).rejects.toBeInstanceOf(InternalServerError)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on server error', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb) => {
      ;(cb as () => void)()
      return 0 as unknown as NodeJS.Timeout
    })
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new InternalServerError('fail', 500, { retryable: true }))
      .mockResolvedValue('ok')
    await expect(withRetry(fn, 2)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('raises after max retries', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb) => {
      ;(cb as () => void)()
      return 0 as unknown as NodeJS.Timeout
    })
    const fn = vi.fn().mockRejectedValue(new InternalServerError('fail', 500, { retryable: true }))
    await expect(withRetry(fn, 2)).rejects.toBeInstanceOf(InternalServerError)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('first retry is immediate', async () => {
    const slept: number[] = []
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb, ms) => {
      slept.push(ms as number)
      ;(cb as () => void)()
      return 0 as unknown as NodeJS.Timeout
    })
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new InternalServerError('fail', 500, { retryable: true }))
      .mockResolvedValue('ok')
    await withRetry(fn, 2)
    expect(slept[0]).toBe(0)
  })

  it('respects retry-after', async () => {
    const slept: number[] = []
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb, ms) => {
      slept.push(ms as number)
      ;(cb as () => void)()
      return 0 as unknown as NodeJS.Timeout
    })
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitError('429', { retryAfter: 42, retryable: true }))
      .mockResolvedValue('ok')
    await withRetry(fn, 2)
    expect(slept[0]).toBe(42_000)
  })
})

describe('isRetrySafe', () => {
  it.each([
    ['GET', 502, true],
    ['DELETE', 503, true],
    ['PATCH', 500, true],
    ['PUT', 504, true],
    ['GET', 408, true],
    ['GET', 501, false],
    ['GET', 404, false],
    ['POST', 502, false],
    ['POST', 500, false],
    ['POST', 408, false],
    ['POST', 429, true],
  ] as const)('%s %i -> %s', (method, status, expected) => {
    expect(isRetrySafe(method, false, { status })).toBe(expected)
  })

  it('an idempotent POST retries like a GET', () => {
    expect(isRetrySafe('POST', true, { status: 502 })).toBe(true)
    expect(isRetrySafe('POST', true, { causeCode: 'UND_ERR_SOCKET' })).toBe(true)
  })

  it('a POST is re-sent only when the connection never opened', () => {
    for (const causeCode of ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT']) {
      expect(isRetrySafe('POST', false, { causeCode })).toBe(true)
    }
    expect(isRetrySafe('POST', false, { causeCode: 'UND_ERR_SOCKET' })).toBe(false)
    expect(isRetrySafe('POST', false, {})).toBe(false)
    expect(isRetrySafe('GET', false, {})).toBe(true)
  })

  it('a Retry-After over 60 s is not waited out', () => {
    expect(isRetrySafe('GET', false, { status: 429, retryAfter: 60 })).toBe(true)
    expect(isRetrySafe('GET', false, { status: 429, retryAfter: 61 })).toBe(false)
  })
})
