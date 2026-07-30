import {
  deriveAgentHostFromBaseUrl,
  resolveAgentHost,
  resolveApiKey,
  resolveBaseUrl,
  resolveMaxRetries,
  resolveOrganizationId,
  resolveTimeoutMs,
} from './_auth.js'

export const DEFAULT_BASE_URL = 'https://api.getmodus.com'
export const DEFAULT_AGENT_HOST = 'https://agent.getmodus.com'
export const DEFAULT_TIMEOUT_MS = 300_000
export const DEFAULT_MAX_RETRIES = 2

export interface ModusOptions {
  /** Modus API key. Falls back to the `MODUS_API_KEY` environment variable. */
  apiKey?: string
  /** API origin without a path suffix (default `https://api.getmodus.com`). */
  baseUrl?: string
  /**
   * Agent-host origin for streaming runs.
   * @internal Staging/local escape hatch — not part of the public client surface.
   */
  agentHost?: string
  /**
   * Optional org id for agent-host run bodies.
   * @internal Usually omit; the PAT principal's org is used.
   */
  organizationId?: string
  /**
   * Per-service origin overrides (e.g. agent-service).
   * @internal Local/dev escape hatch — not part of the public client surface.
   */
  baseUrls?: Record<string, string>
  /** Request timeout in milliseconds (default 300000). */
  timeoutMs?: number
  /** Retries on rate limits and server errors (default 2). */
  maxRetries?: number
  /**
   * Custom fetch implementation.
   * @internal Test injection only.
   */
  fetch?: typeof fetch
}

export interface ModusConfig {
  readonly apiKey: string
  readonly baseUrl: string
  readonly agentHost: string
  readonly organizationId?: string
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
  const baseUrlOverrides = normalizeBaseUrls(options.baseUrls)
  // baseUrls['agent-service'] must drive streaming too (same origin as invoke).
  // When unset, derive agent.<rest> from api.<rest> baseUrl so staging chat
  // works with only the API origin env override (no separate agent-host override).
  const agentHost = normalizeBaseUrl(
    baseUrlOverrides['agent-service'] ??
      resolveAgentHost(options.agentHost) ??
      deriveAgentHostFromBaseUrl(baseUrl) ??
      DEFAULT_AGENT_HOST,
  )
  const organizationId = resolveOrganizationId(options.organizationId)
  return Object.freeze({
    apiKey: resolveApiKey(options.apiKey),
    baseUrl,
    agentHost,
    ...(organizationId !== undefined ? { organizationId } : {}),
    baseUrls: Object.freeze({
      'modus-api': baseUrl,
      'agent-service': agentHost,
      ...baseUrlOverrides,
    }),
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
  // Prefer explicit agentHost / baseUrls over OpenAPI-codegen serverUrl so
  // MODUS_AGENT_HOST and agentHost= always win over stale generated defaults.
  if (service === 'agent-service') {
    return config.baseUrls['agent-service'] ?? config.agentHost ?? generatedBaseUrl ?? config.baseUrl
  }
  return config.baseUrls[service] ?? generatedBaseUrl ?? config.baseUrl
}

export function formatConfigForLog(config: ModusConfig): string {
  const masked = config.apiKey.length > 10 ? `${config.apiKey.slice(0, 10)}***` : '***'
  return `ModusConfig(apiKey=${JSON.stringify(masked)}, baseUrl=${JSON.stringify(config.baseUrl)}, timeoutMs=${config.timeoutMs}, maxRetries=${config.maxRetries})`
}
