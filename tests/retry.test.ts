import { afterEach, describe, expect, it, vi } from 'vitest'
import { InternalServerError, NotFoundError, RateLimitError } from '../src/_exceptions.js'
import { withRetry } from '../src/_retry.js'

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

  it('retries on server error', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb) => {
      ;(cb as () => void)()
      return 0 as unknown as NodeJS.Timeout
    })
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new InternalServerError('fail', 500))
      .mockResolvedValue('ok')
    await expect(withRetry(fn, 2)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('raises after max retries', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb) => {
      ;(cb as () => void)()
      return 0 as unknown as NodeJS.Timeout
    })
    const fn = vi.fn().mockRejectedValue(new InternalServerError('fail', 500))
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
      .mockRejectedValueOnce(new InternalServerError('fail', 500))
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
      .mockRejectedValueOnce(new RateLimitError('429', { retryAfter: 42 }))
      .mockResolvedValue('ok')
    await withRetry(fn, 2)
    expect(slept[0]).toBe(42_000)
  })
})
