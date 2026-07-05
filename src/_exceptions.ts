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

export class APIConnectionError extends ModusError {
  constructor(message: string) {
    super(message)
    this.name = 'APIConnectionError'
  }
}

export class AuthenticationError extends ModusError {
  constructor(message: string, options: ConstructorParameters<typeof ModusError>[1] = {}) {
    super(message, { ...options, statusCode: 401 })
    this.name = 'AuthenticationError'
  }
}

export class PermissionDeniedError extends ModusError {
  constructor(message: string, options: ConstructorParameters<typeof ModusError>[1] = {}) {
    super(message, { ...options, statusCode: 403 })
    this.name = 'PermissionDeniedError'
  }
}

export class NotFoundError extends ModusError {
  constructor(message: string, options: ConstructorParameters<typeof ModusError>[1] = {}) {
    super(message, { ...options, statusCode: 404 })
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends ModusError {
  constructor(message: string, options: ConstructorParameters<typeof ModusError>[1] = {}) {
    super(message, { ...options, statusCode: 409 })
    this.name = 'ConflictError'
  }
}

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

export class InternalServerError extends ModusError {
  constructor(message: string, statusCode: number, options: ConstructorParameters<typeof ModusError>[1] = {}) {
    super(message, { ...options, statusCode })
    this.name = 'InternalServerError'
  }
}

export class RunCancelledError extends ModusError {
  constructor(message = 'Run was cancelled.') {
    super(message)
    this.name = 'RunCancelledError'
  }
}

export class StreamTimeoutError extends ModusError {
  constructor(message = 'Stream timed out.') {
    super(message)
    this.name = 'StreamTimeoutError'
  }
}

export class ValidationError extends ModusError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
