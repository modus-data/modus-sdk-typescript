import {
  deriveAgentHostFromBaseUrl,
  resolveAgentHost,
  resolveApiKey,
  resolveBaseUrl,
  resolveMaxRetries,
  resolveOrganizationId,
  resolveTimeoutMs,
} from './_auth.js'
import { ModusError } from './_exceptions.js'

export const DEFAULT_BASE_URL = 'https://api.getmodus.com'
export const DEFAULT_TIMEOUT_MS = 300_000
export const DEFAULT_MAX_RETRIES = 2

export interface ModusOptions {
  /** Modus API key. Falls back to the `MODUS_API_KEY` environment variable. */
  apiKey?: string
  /** API origin without a path suffix (default `https://api.getmodus.com`). */
  baseUrl?: string
  /**
   * Agent-host origin for chat, runs and context compose (`getContext()`). Derived from a Modus
   * `baseUrl`: `api.getmodus.com` → `agent.getmodus.com`, `api.<env>.getmodus.com` →
   * `agent.<env>.getmodus.com`. Required for any other `baseUrl`.
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
   * Headers sent on every request. They override the SDK's own defaults, except
   * `Authorization`, which always comes from `apiKey`.
   */
  defaultHeaders?: Record<string, string>
  /**
   * Custom fetch implementation.
   * @internal Test injection only.
   */
  fetch?: typeof fetch
}

export interface ModusConfig {
  readonly apiKey: string
  readonly baseUrl: string
  /** Agent host for chat and runs; undefined when it cannot be derived from a custom baseUrl. */
  readonly agentHost: string | undefined
  readonly organizationId?: string
  readonly baseUrls: Readonly<Record<string, string>>
  readonly timeoutMs: number
  readonly maxRetries: number
  readonly defaultHeaders: Readonly<Record<string, string>>
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
  // works with only the API origin env override. A custom baseUrl gets no
  // agent host rather than production's, which would receive its token.
  const explicitAgentHost =
    baseUrlOverrides['agent-service'] ??
    resolveAgentHost(options.agentHost) ??
    deriveAgentHostFromBaseUrl(baseUrl)
  const agentHost = explicitAgentHost === undefined ? undefined : normalizeBaseUrl(explicitAgentHost)
  const organizationId = resolveOrganizationId(options.organizationId)
  return Object.freeze({
    apiKey: resolveApiKey(options.apiKey),
    baseUrl,
    agentHost,
    ...(organizationId !== undefined ? { organizationId } : {}),
    baseUrls: Object.freeze({
      'modus-api': baseUrl,
      ...(agentHost !== undefined ? { 'agent-service': agentHost } : {}),
      ...baseUrlOverrides,
    }),
    timeoutMs: resolveTimeoutMs(options.timeoutMs) ?? DEFAULT_TIMEOUT_MS,
    maxRetries,
    defaultHeaders: Object.freeze({ ...options.defaultHeaders }),
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
  if (service === 'agent-service') return requireAgentHost(config)
  return config.baseUrls[service] ?? generatedBaseUrl ?? config.baseUrl
}

export function formatConfigForLog(config: ModusConfig): string {
  const masked = config.apiKey.length > 10 ? `${config.apiKey.slice(0, 10)}***` : '***'
  return `ModusConfig(apiKey=${JSON.stringify(masked)}, baseUrl=${JSON.stringify(config.baseUrl)}, timeoutMs=${config.timeoutMs}, maxRetries=${config.maxRetries})`
}

/** The agent host for chat and runs; throws when a custom baseUrl leaves it unknown. */
export function requireAgentHost(config: ModusConfig): string {
  if (config.agentHost === undefined) {
    throw new ModusError(
      `No agent host for baseUrl ${JSON.stringify(config.baseUrl)}. ` +
        'Pass agentHost (or set MODUS_AGENT_HOST) to chat or run with a custom baseUrl.',
    )
  }
  return config.agentHost
}
