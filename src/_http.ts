import { authHeaders } from './_auth.js'
import type { ModusConfig } from './_config.js'
import {
  APIConnectionError,
  AuthenticationError,
  ConflictError,
  InternalServerError,
  ModusError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableError,
} from './_exceptions.js'

const USER_AGENT = `modus-typescript/${__SDK_VERSION__} (node/${process.version}; ${process.platform})`

type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[]
type QueryParams = Record<string, QueryValue>
type RequestOptions = {
  baseUrl?: string
  headers?: Record<string, string>
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

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

function messageFromBody(raw: string, statusCode: number): string {
  if (!raw) return `HTTP ${statusCode}`
  try {
    const body = JSON.parse(raw) as unknown
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>
      const envelope = record.error
      if (envelope && typeof envelope === 'object') {
        const msg = (envelope as Record<string, unknown>).message
        if (typeof msg === 'string' && msg) return msg
      }
      const msg = record.message ?? record.error
      if (Array.isArray(msg)) return msg.map(String).join('; ')
      if (typeof msg === 'string' && msg) return msg
    }
  } catch {
    // non-JSON body
  }
  return raw
}

function errorCodeFromBody(raw: string): string | undefined {
  try {
    const body = JSON.parse(raw) as { error?: { code?: string } }
    return typeof body.error?.code === 'string' ? body.error.code : undefined
  } catch {
    return undefined
  }
}

export function raiseForStatus(response: Response, body: string): void {
  if (response.ok) return
  const message = messageFromBody(body, response.status)
  const requestId =
    response.headers.get('x-request-id') ?? response.headers.get('X-Request-ID') ?? undefined
  const headers = headersToRecord(response.headers)
  const code = errorCodeFromBody(body)
  const base = { requestId, responseHeaders: headers, body, code }

  switch (response.status) {
    case 401:
      throw new AuthenticationError(message, base)
    case 403:
      throw new PermissionDeniedError(message, base)
    case 404:
      throw new NotFoundError(message, base)
    case 409:
      throw new ConflictError(message, base)
    case 422: {
      let errors: unknown
      try {
        errors = JSON.parse(body)
      } catch {
        errors = undefined
      }
      throw new UnprocessableError(message, { ...base, errors })
    }
    case 429: {
      const retryHeader = response.headers.get('retry-after') ?? ''
      const retryAfter = /^\d+$/.test(retryHeader) ? Number.parseInt(retryHeader, 10) : undefined
      throw new RateLimitError(message, { ...base, retryAfter })
    }
    default:
      if (response.status >= 500) {
        throw new InternalServerError(message, response.status, base)
      }
      throw new ModusError(message, { ...base, statusCode: response.status })
  }
}

function wrapNetworkError(error: unknown, baseUrl: string): APIConnectionError {
  const detail = error instanceof Error ? error.message : String(error)
  return new APIConnectionError(
    `Network error communicating with Modus API at ${JSON.stringify(baseUrl)}: ${detail}. ` +
      'Check connectivity and that baseUrl is correct.',
  )
}

async function readBody(response: Response): Promise<string> {
  return response.text()
}

export class HttpClient {
  readonly config: ModusConfig

  constructor(config: ModusConfig) {
    this.config = config
  }

  private defaultHeaders(): Record<string, string> {
    return {
      ...authHeaders(this.config.apiKey),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    }
  }

  private async request(
    method: string,
    path: string,
    options: { params?: QueryParams; json?: unknown } & RequestOptions = {},
  ): Promise<unknown> {
    const baseUrl = options.baseUrl ?? this.config.baseUrl
    const url = buildUrl(baseUrl, path, options.params)
    try {
      const response = await this.config.fetch(url, {
        method,
        headers: { ...this.defaultHeaders(), ...options.headers },
        body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
      const body = await readBody(response)
      raiseForStatus(response, body)
      if (response.status === 204 || !body) return null
      return JSON.parse(body) as unknown
    } catch (error) {
      if (error instanceof ModusError) throw error
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw wrapNetworkError(new Error('Request timed out'), baseUrl)
      }
      throw wrapNetworkError(error, baseUrl)
    }
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
    try {
      const response = await this.config.fetch(url, {
        method,
        // Agent-service negotiates SSE vs JSON polling on Accept; JSON-only
        // Accept returns {"runId","status":"pending"} instead of token SSE.
        headers: {
          ...this.defaultHeaders(),
          ...options.headers,
          Accept: 'text/event-stream',
        },
        body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })
      if (!response.ok) {
        const body = await readBody(response)
        raiseForStatus(response, body)
        return
      }
      if (!response.body) return
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
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
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw wrapNetworkError(new Error('Request timed out'), baseUrl)
      }
      throw wrapNetworkError(error, baseUrl)
    }
  }

  streamGet(path: string, params?: QueryParams, options: RequestOptions = {}): AsyncGenerator<string> {
    return this.stream('GET', path, { params, ...options })
  }

  streamPost(path: string, json?: unknown, options: RequestOptions = {}): AsyncGenerator<string> {
    return this.stream('POST', path, { json, ...options })
  }
}
