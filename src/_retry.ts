import { ModusError, NotFoundError, RateLimitError } from './_exceptions.js'

const DEPLOY_NOT_FOUND_BACKOFF_MS = 500
const MAX_DEPLOY_NOT_FOUND_RETRIES = 1

/** The longest `Retry-After` the SDK sleeps; a longer one is thrown as `RateLimitError` at once. */
export const MAX_RETRY_AFTER_SECONDS = 60

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504])

/** Undici `cause.code`s for failures before any request byte was written. */
const CONNECT_PHASE_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'])

/** What went wrong: an HTTP status, or a network failure with its undici cause code. */
export type RequestFailure = { status: number; retryAfter?: number } | { causeCode?: string }

/**
 * The SDK's one retry rule: may this request be sent again without doing its work twice?
 *
 * - 429: yes (the rate limiter rejected it before any work), unless `Retry-After` exceeds 60 s.
 * - A connect-phase failure (refused, DNS, connect timeout): yes, nothing was sent.
 * - 408, 500, 502, 503, 504, or a failure after sending (reset, timeout): only for
 *   GET/PUT/PATCH/DELETE, and for a POST whose operation only reads or sets a state.
 *   Any other POST may already have run on the server.
 */
export function isRetrySafe(method: string, idempotent: boolean, failure: RequestFailure): boolean {
  if ('status' in failure) {
    if (failure.status === 429) return (failure.retryAfter ?? 0) <= MAX_RETRY_AFTER_SECONDS
    if (!RETRY_STATUSES.has(failure.status)) return false
  } else if (failure.causeCode !== undefined && CONNECT_PHASE_CODES.has(failure.causeCode)) {
    return true
  }
  return method !== 'POST' || idempotent
}

export interface WithRetryOptions {
  /** Read-after-write on deploy; one short retry on 404. */
  retryNotFoundOnDeploy?: boolean
}

function backoffSeconds(attempt: number, error: ModusError): number {
  if (error instanceof RateLimitError && error.retryAfter !== undefined) return error.retryAfter
  if (attempt === 0) return 0
  return Math.max(0.5, 2 ** (attempt - 1) + (Math.random() * 0.6 - 0.3))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Call `fn`, re-sending up to `maxRetries` times while the error is `retryable`. `fn` gets
 * the number of sends before this one: 0 first, then 1, 2, … on each re-send.
 */
export async function withRetry<T>(
  fn: (resend: number) => Promise<T>,
  maxRetries: number,
  options: WithRetryOptions = {},
): Promise<T> {
  let deployNotFoundRetries = 0
  let attempt = 0
  let sends = 0
  while (true) {
    try {
      return await fn(sends++)
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
      if (!(error instanceof ModusError) || !error.retryable || attempt >= maxRetries) throw error
      await sleep(backoffSeconds(attempt, error) * 1000)
      attempt++
    }
  }
}
