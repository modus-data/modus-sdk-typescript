import { authHeaders } from './_auth.js'
import type { ModusConfig } from './_config.js'
import {
  APIConnectionError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  ModusError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableError,
} from './_exceptions.js'
import { isRetrySafe } from './_retry.js'
import { headerValue, traceIdOf, traceparent } from './_trace.js'

const USER_AGENT = `modus-typescript/${__SDK_VERSION__} (node/${process.version}; ${process.platform})`

type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[]
type QueryParams = Record<string, QueryValue>
type RequestOptions = {
  baseUrl?: string
  headers?: Record<string, string>
  /** A POST that only reads or sets a state, so it is safe to re-send after a 5xx or a timeout. */
  idempotent?: boolean
}

function buildUrl(baseUrl: string, path: string, params?: QueryParams): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, baseUrl)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item))
      } else {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.toString()
}

/** Later layers win; header names compare case-insensitively, as HTTP defines them. */
function mergeHeaders(
  ...layers: (Readonly<Record<string, string>> | undefined)[]
): Record<string, string> {
  const merged = new Map<string, [string, string]>()
  for (const layer of layers) {
    for (const [name, value] of Object.entries(layer ?? {})) {
      merged.set(name.toLowerCase(), [name, value])
    }
  }
  return Object.fromEntries(merged.values())
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined
}

interface ErrorFields {
  message: string
  code?: string
  requestId?: string
  info?: Record<string, unknown>
  /** The parsed body, when it is JSON. */
  parsed?: unknown
}

/**
 * Read an error body once: Modus's envelope `{"error":{code,message,requestId,info}}`,
 * an API Gateway body `{"message":"..."}`, or anything else as raw text.
 */
function parseErrorBody(raw: string, statusCode: number): ErrorFields {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { message: raw || `HTTP ${statusCode}` }
  }
  if (!isRecord(parsed)) return { message: raw, parsed }
  const envelope = parsed.error
  if (isRecord(envelope)) {
    return {
      message: nonEmptyString(envelope.message) ?? raw,
      code: nonEmptyString(envelope.code),
      requestId: nonEmptyString(envelope.requestId),
      info: isRecord(envelope.info) ? envelope.info : undefined,
      parsed,
    }
  }
  const message = parsed.message ?? parsed.error
  if (Array.isArray(message)) return { message: message.map(String).join('; '), parsed }
  return { message: nonEmptyString(message) ?? raw, parsed }
}

/**
 * Seconds to wait, from `retry-after-ms` or `Retry-After` (delta-seconds or an HTTP date),
 * rounded up to whole seconds.
 */
function parseRetryAfter(headers: Headers): number | undefined {
  const ms = headers.get('retry-after-ms')?.trim()
  if (ms && /^\d+(\.\d+)?$/.test(ms)) return Math.ceil(Number(ms) / 1000)
  const value = headers.get('retry-after')?.trim()
  if (!value) return undefined
  if (/^\d+$/.test(value)) return Number(value)
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000))
}

export function raiseForStatus(
  response: Response,
  body: string,
  method = 'GET',
  idempotent = false,
  traceId?: string,
): void {
  if (response.ok) return
  const status = response.status
  const { message, code, requestId, info, parsed } = parseErrorBody(body, status)
  const retryAfter = status === 429 ? parseRetryAfter(response.headers) : undefined
  const base = {
    requestId: requestId ?? response.headers.get('x-request-id') ?? undefined,
    traceId,
    responseHeaders: headersToRecord(response.headers),
    body,
    code,
    info,
    retryable: isRetrySafe(method, idempotent, { status, retryAfter }),
  }

  switch (status) {
    case 400:
      throw new BadRequestError(message, base)
    case 401:
      throw new AuthenticationError(message, base)
    case 403:
      throw new PermissionDeniedError(message, base)
    case 404:
      throw new NotFoundError(message, base)
    case 409:
      throw new ConflictError(message, base)
    case 422:
      throw new UnprocessableError(message, { ...base, errors: parsed })
    case 429:
      throw new RateLimitError(message, { ...base, retryAfter })
    default:
      if (status >= 500) throw new InternalServerError(message, status, base)
      throw new ModusError(message, { ...base, statusCode: status })
  }
}

function wrapNetworkError(
  error: unknown,
  baseUrl: string,
  method: string,
  idempotent: boolean,
  traceId: string | undefined,
): APIConnectionError {
  const detail =
    error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
      ? 'Request timed out'
      : error instanceof Error
        ? error.message
        : String(error)
  const cause = error instanceof Error ? error.cause : undefined
  const causeCode = isRecord(cause) ? nonEmptyString(cause.code) : undefined
  return new APIConnectionError(
    `Network error communicating with Modus API at ${JSON.stringify(baseUrl)}: ${detail}. ` +
      'Check connectivity and that baseUrl is correct.',
    { retryable: isRetrySafe(method, idempotent, { causeCode }), traceId },
  )
}

/** Parse a 2xx JSON body; one that is not JSON is a non-retryable ModusError, not a network error. */
function parseJsonBody(response: Response, body: string, traceId: string | undefined): unknown {
  try {
    return JSON.parse(body) as unknown
  } catch {
    const contentType = response.headers.get('content-type') ?? ''
    throw new ModusError(
      `Invalid JSON in HTTP ${response.status} response (content-type ${JSON.stringify(contentType)}): ` +
        body.slice(0, 200),
      {
        statusCode: response.status,
        requestId: response.headers.get('x-request-id') ?? undefined,
        traceId,
        responseHeaders: headersToRecord(response.headers),
        body,
      },
    )
  }
}

/** Adds a new `traceparent` unless the caller sent their own; returns the trace id sent. */
function withTraceparent(headers: Record<string, string>): { headers: Record<string, string>; traceId?: string } {
  const own = headerValue(headers, 'traceparent')
  if (own !== undefined) return { headers, traceId: traceIdOf(own) }
  const value = traceparent()
  return { headers: { ...headers, traceparent: value }, traceId: traceIdOf(value) }
}

/** Read at most `maxChars` from the body, then cancel the remainder. */
async function readBodyPreview(response: Response, maxChars = 200): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let out = ''
  try {
    while (out.length < maxChars) {
      const { done, value } = await reader.read()
      if (done) break
      out += decoder.decode(value, { stream: true })
      if (out.length >= maxChars) {
        out = out.slice(0, maxChars)
        break
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  return out
}

export class HttpClient {
  readonly config: ModusConfig

  constructor(config: ModusConfig) {
    this.config = config
  }

  private defaultHeaders(): Record<string, string> {
    return mergeHeaders(
      {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'X-Modus-Client': 'sdk',
      },
      this.config.defaultHeaders,
    )
  }

  private async request(
    method: string,
    path: string,
    options: { params?: QueryParams; json?: unknown } & RequestOptions = {},
  ): Promise<unknown> {
    const baseUrl = options.baseUrl ?? this.config.baseUrl
    const url = buildUrl(baseUrl, path, options.params)
    const idempotent = options.idempotent ?? false
    const { headers, traceId } = withTraceparent(
      mergeHeaders(this.defaultHeaders(), options.headers, authHeaders(this.config.apiKey)),
    )
    let response: Response
    let body: string
    try {
      response = await this.config.fetch(url, {
        method,
        headers,
        body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
      body = await response.text()
    } catch (error) {
      throw wrapNetworkError(error, baseUrl, method, idempotent, traceId)
    }
    raiseForStatus(response, body, method, idempotent, traceId)
    if (response.status === 204 || !body) return null
    return parseJsonBody(response, body, traceId)
  }

  get(path: string, params?: QueryParams, options: RequestOptions = {}): Promise<unknown> {
    return this.request('GET', path, { params, ...options })
  }

  post(path: string, json?: unknown, options: RequestOptions = {}): Promise<unknown> {
    return this.request('POST', path, { json, ...options })
  }

  put(path: string, json?: unknown, options: RequestOptions = {}): Promise<unknown> {
    return this.request('PUT', path, { json, ...options })
  }

  patch(
    path: string,
    json?: unknown,
    params?: QueryParams,
    options: RequestOptions = {},
  ): Promise<unknown> {
    return this.request('PATCH', path, { json, params, ...options })
  }

  delete(path: string, options: RequestOptions = {}): Promise<unknown> {
    return this.request('DELETE', path, options)
  }

  private async *stream(
    method: 'GET' | 'POST',
    path: string,
    options: { json?: unknown; params?: QueryParams } & RequestOptions = {},
  ): AsyncGenerator<string> {
    const baseUrl = options.baseUrl ?? this.config.baseUrl
    const url = buildUrl(baseUrl, path, options.params)
    const idempotent = options.idempotent ?? false
    // A run streams for as long as the agent works on it, so timeoutMs bounds
    // silence between chunks (keepalives included), not the whole stream.
    const idle = new IdleTimeout(this.config.timeoutMs)
    // Agent-service negotiates SSE vs JSON polling on Accept; JSON-only
    // Accept returns {"runId","status":"pending"} instead of token SSE.
    const { headers, traceId } = withTraceparent(
      mergeHeaders(
        this.defaultHeaders(),
        options.headers,
        { Accept: 'text/event-stream' },
        authHeaders(this.config.apiKey),
      ),
    )
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      const response = await this.config.fetch(url, {
        method,
        headers,
        body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
        signal: idle.signal,
      })
      idle.touch()
      if (!response.ok) {
        raiseForStatus(response, await response.text(), method, idempotent, traceId)
        return
      }
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.toLowerCase().includes('text/event-stream')) {
        const preview = await readBodyPreview(response)
        throw new ModusError(
          `Unexpected stream response: expected Content-Type text/event-stream, ` +
            `got ${JSON.stringify(contentType) || '(missing)'}. ` +
            `Body preview: ${preview}`,
          { statusCode: response.status, body: preview, traceId },
        )
      }
      if (!response.body) return
      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        idle.touch()
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.trim()) yield line
        }
      }
      if (buffer.trim()) yield buffer
    } catch (error) {
      if (error instanceof ModusError) throw error
      throw wrapNetworkError(error, baseUrl, method, idempotent, traceId)
    } finally {
      idle.clear()
      // A consumer that stops early must not leave the connection open.
      await reader?.cancel().catch(() => undefined)
    }
  }

  streamGet(path: string, params?: QueryParams, options: RequestOptions = {}): AsyncGenerator<string> {
    return this.stream('GET', path, { params, ...options })
  }

  streamPost(path: string, json?: unknown, options: RequestOptions = {}): AsyncGenerator<string> {
    return this.stream('POST', path, { json, ...options })
  }
}

class IdleTimeout {
  private readonly controller = new AbortController()
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly ms: number) {
    this.touch()
  }

  get signal(): AbortSignal {
    return this.controller.signal
  }

  touch(): void {
    this.clear()
    this.timer = setTimeout(
      () => this.controller.abort(new DOMException('Stream idle timeout', 'TimeoutError')),
      this.ms,
    )
  }

  clear(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
  }
}
