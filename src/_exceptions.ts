/**
 * Base class for all Modus SDK errors.
 *
 * HTTP failures map to subclasses by status code. Streaming run failures map
 * from event types (`error`, `cancelled`, `stream_timeout`).
 */
export class ModusError extends Error {
  readonly statusCode?: number
  /** The `requestId` of the error envelope (or the `x-request-id` header); quote it to support. */
  readonly requestId?: string
  /**
   * The W3C trace id of the request that failed (from the `traceparent` the SDK sent). Quote
   * it with `requestId`: it also names a request that never reached Modus, and every retry of it.
   */
  readonly traceId?: string
  readonly responseHeaders?: Record<string, string>
  readonly body?: string
  /** Machine-readable error code from the envelope, e.g. `NOT_FOUND`, `VALIDATION`. */
  readonly code?: string
  /** Structured detail from the envelope, e.g. `{ missing: ['scopes:write'] }` on a 403. */
  readonly info?: Record<string, unknown>
  /**
   * Whether the SDK's retry rule allows re-sending this call. True for a 429 whose
   * `Retry-After` is absent or at most 60 s, and for a connection that never opened. For
   * 408, 500, 502, 503, 504, a dropped connection or a timeout: true on GET, PUT, PATCH and
   * DELETE and on POSTs that only read or set a state, false on any other POST, which may
   * already have run. The SDK already retried a retryable error up to `maxRetries` times.
   */
  readonly retryable: boolean

  constructor(
    message: string,
    options: {
      statusCode?: number
      requestId?: string
      traceId?: string
      responseHeaders?: Record<string, string>
      body?: string
      code?: string
      info?: Record<string, unknown>
      retryable?: boolean
    } = {},
  ) {
    super(message)
    this.name = 'ModusError'
    this.message = message
    this.statusCode = options.statusCode
    this.requestId = options.requestId
    this.traceId = options.traceId
    this.responseHeaders = options.responseHeaders
    this.body = options.body
    this.code = options.code
    this.info = options.info
    this.retryable = options.retryable ?? false
  }
}

/**
 * Network-level failure (connection error, read timeout, etc.) after all
 * automatic retries are exhausted.
 */
export class APIConnectionError extends ModusError {
  constructor(message: string, options: { retryable?: boolean; traceId?: string } = {}) {
    super(message, options)
    this.name = 'APIConnectionError'
  }
}

/**
 * The request was malformed (HTTP 400): a parameter or body field failed schema
 * validation, an unknown property was sent, or an id was not a number. `message`
 * names the field.
 */
export class BadRequestError extends ModusError {
  constructor(message: string, options: ConstructorParameters<typeof ModusError>[1] = {}) {
    super(message, { ...options, statusCode: 400 })
    this.name = 'BadRequestError'
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
 * The request was well-formed but failed a business rule (HTTP 422, `code: VALIDATION`),
 * for example a toolset rule or a disallowed file type. Schema failures are
 * {@link BadRequestError} (400) instead.
 *
 * `info` carries the rule detail when the server sends one (e.g. `info.violations`);
 * `errors` is the whole parsed error envelope.
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
 * When present, `retryAfter` is the server's requested wait in whole seconds (from
 * `retry-after-ms`, or `Retry-After` as seconds or an HTTP date). The SDK waits it out
 * and retries when it is 60 s or less; a longer wait is thrown at once.
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
