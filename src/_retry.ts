import {
  APIConnectionError,
  InternalServerError,
  NotFoundError,
  RateLimitError,
} from './_exceptions.js'

const DEPLOY_NOT_FOUND_BACKOFF_MS = 500
const MAX_DEPLOY_NOT_FOUND_RETRIES = 1

export interface WithRetryOptions {
  /** Read-after-write on deploy; one short retry on 404. */
  retryNotFoundOnDeploy?: boolean
}

const RETRYABLE = [RateLimitError, InternalServerError, APIConnectionError] as const

function isRetryable(error: unknown): error is InstanceType<(typeof RETRYABLE)[number]> {
  return RETRYABLE.some((Cls) => error instanceof Cls)
}

function backoffSeconds(attempt: number, error: unknown): number {
  if (error instanceof RateLimitError && error.retryAfter !== undefined) {
    return Math.max(0, error.retryAfter)
  }
  if (attempt === 0) return 0
  return Math.max(0.5, 2 ** (attempt - 1) + (Math.random() * 0.6 - 0.3))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  options: WithRetryOptions = {},
): Promise<T> {
  let deployNotFoundRetries = 0
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (error) {
      if (
        options.retryNotFoundOnDeploy &&
        error instanceof NotFoundError &&
        deployNotFoundRetries < MAX_DEPLOY_NOT_FOUND_RETRIES
      ) {
        deployNotFoundRetries++
        await sleep(DEPLOY_NOT_FOUND_BACKOFF_MS)
        continue
      }
      if (!isRetryable(error) || attempt >= maxRetries) throw error
      await sleep(backoffSeconds(attempt, error) * 1000)
      attempt++
    }
  }
}
