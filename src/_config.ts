import {
  resolveApiKey,
  resolveBaseUrl,
  resolveMaxRetries,
  resolveTimeoutMs,
} from './_auth.js'

export const DEFAULT_BASE_URL = 'https://api.modus.com'
export const DEFAULT_TIMEOUT_MS = 300_000
export const DEFAULT_MAX_RETRIES = 2

export interface ModusOptions {
  apiKey?: string
  baseUrl?: string
  /**
   * Override service-specific API origins, for example:
   * `{ 'agent-service': 'http://localhost:3130' }`.
   */
  baseUrls?: Record<string, string>
  /** Request timeout in milliseconds. */
  timeoutMs?: number
  maxRetries?: number
  /** Test injection only. */
  fetch?: typeof fetch
}

export interface ModusConfig {
  readonly apiKey: string
  readonly baseUrl: string
  readonly baseUrls: Readonly<Record<string, string>>
  readonly timeoutMs: number
  readonly maxRetries: number
  readonly fetch: typeof fetch
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '')
}

function normalizeBaseUrls(baseUrls: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(baseUrls ?? {}).map(([service, baseUrl]) => [
      service,
      normalizeBaseUrl(baseUrl),
    ]),
  )
}

export function createModusConfig(options: ModusOptions = {}): ModusConfig {
  const maxRetries = resolveMaxRetries(options.maxRetries) ?? DEFAULT_MAX_RETRIES
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new Error(`max_retries must be a non-negative int, got ${maxRetries}`)
  }
  const baseUrl = normalizeBaseUrl(resolveBaseUrl(options.baseUrl) ?? DEFAULT_BASE_URL)
  return Object.freeze({
    apiKey: resolveApiKey(options.apiKey),
    baseUrl,
    baseUrls: Object.freeze({ 'modus-api': baseUrl, ...normalizeBaseUrls(options.baseUrls) }),
    timeoutMs: resolveTimeoutMs(options.timeoutMs) ?? DEFAULT_TIMEOUT_MS,
    maxRetries,
    fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
  })
}

export function resolveServiceBaseUrl(
  config: ModusConfig,
  service: string,
  generatedBaseUrl?: string | null,
): string {
  return config.baseUrls[service] ?? generatedBaseUrl ?? config.baseUrl
}

export function formatConfigForLog(config: ModusConfig): string {
  const masked = config.apiKey.length > 10 ? `${config.apiKey.slice(0, 10)}***` : '***'
  return `ModusConfig(apiKey=${JSON.stringify(masked)}, baseUrl=${JSON.stringify(config.baseUrl)}, timeoutMs=${config.timeoutMs}, maxRetries=${config.maxRetries})`
}
