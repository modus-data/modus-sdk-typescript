/**
 * Base class for all Modus SDK errors.
 *
 * HTTP failures map to subclasses by status code. Streaming run failures map
 * from event types (`error`, `cancelled`, `stream_timeout`).
 */
export class ModusError extends Error {
  readonly statusCode?: number
  readonly requestId?: string
  readonly responseHeaders?: Record<string, string>
  readonly body?: string
  readonly code?: string

  constructor(
    message: string,
    options: {
      statusCode?: number
      requestId?: string
      responseHeaders?: Record<string, string>
      body?: string
      code?: string
    } = {},
  ) {
    super(message)
    this.name = 'ModusError'
    this.message = message
    this.statusCode = options.statusCode
    this.requestId = options.requestId
    this.responseHeaders = options.responseHeaders
    this.body = options.body
    this.code = options.code
  }
}

/**
 * Network-level failure (connection error, read timeout, etc.) after all
 * automatic retries are exhausted.
 */
export class APIConnectionError extends ModusError {
  constructor(message: string) {
    super(message)
    this.name = 'APIConnectionError'
  }
}

/**
 * The API key is missing, invalid, or expired (HTTP 401).
 *
 * Check that `MODUS_API_KEY` is set correctly, or pass `apiKey` explicitly.
 * Create a token at app.getmodus.com → Settings → API Tokens.
 */
export class AuthenticationError extends ModusError {
  constructor(message: string, options: ConstructorParameters<typeof ModusError>[1] = {}) {
    super(message, { ...options, statusCode: 401 })
    this.name = 'AuthenticationError'
  }
}

/**
 * The API key does not have permission for the requested operation (HTTP 403).
 */
export class PermissionDeniedError extends ModusError {
  constructor(message: string, options: ConstructorParameters<typeof ModusError>[1] = {}) {
    super(message, { ...options, statusCode: 403 })
    this.name = 'PermissionDeniedError'
  }
}

/** The requested resource does not exist (HTTP 404). */
export class NotFoundError extends ModusError {
  constructor(message: string, options: ConstructorParameters<typeof ModusError>[1] = {}) {
    super(message, { ...options, statusCode: 404 })
    this.name = 'NotFoundError'
  }
}

/**
 * The request conflicts with existing state (HTTP 409).
 *
 * Inspect the API message for the operation-specific outcome. For ingested-data
 * uploads, this means the complete payload is already stored and is a safe retry
 * outcome.
 */
export class ConflictError extends ModusError {
  constructor(message: string, options: ConstructorParameters<typeof ModusError>[1] = {}) {
    super(message, { ...options, statusCode: 409 })
    this.name = 'ConflictError'
  }
}

/**
 * Request validation failed (HTTP 422).
 *
 * Inspect `errors` when present for field-level details.
 */
export class UnprocessableError extends ModusError {
  readonly errors?: unknown

  constructor(
    message: string,
    options: ConstructorParameters<typeof ModusError>[1] & { errors?: unknown } = {},
  ) {
    super(message, { ...options, statusCode: 422 })
    this.name = 'UnprocessableError'
    this.errors = options.errors
  }
}

/**
 * Too many requests (HTTP 429).
 *
 * When present, `retryAfter` is the suggested wait in seconds.
 */
export class RateLimitError extends ModusError {
  readonly retryAfter?: number

  constructor(
    message: string,
    options: ConstructorParameters<typeof ModusError>[1] & { retryAfter?: number } = {},
  ) {
    super(message, { ...options, statusCode: 429 })
    this.name = 'RateLimitError'
    this.retryAfter = options.retryAfter
  }
}

/** Unexpected server failure (HTTP 5xx). */
export class InternalServerError extends ModusError {
  constructor(message: string, statusCode: number, options: ConstructorParameters<typeof ModusError>[1] = {}) {
    super(message, { ...options, statusCode })
    this.name = 'InternalServerError'
  }
}

/** The run was cancelled before it finished. */
export class RunCancelledError extends ModusError {
  constructor(message = 'Run was cancelled.') {
    super(message)
    this.name = 'RunCancelledError'
  }
}

/** The streaming connection timed out before a final result arrived. */
export class StreamTimeoutError extends ModusError {
  constructor(message = 'Stream timed out.') {
    super(message)
    this.name = 'StreamTimeoutError'
  }
}

/**
 * Client-side argument validation failed before a request was sent
 * (for example an unsupported chat model id).
 */
export class ValidationError extends ModusError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
