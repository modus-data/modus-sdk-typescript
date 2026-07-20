import { AuthenticationError } from './_exceptions.js'

const ENV_API_KEY = 'MODUS_API_KEY'
const ENV_BASE_URL = 'MODUS_BASE_URL'
const ENV_AGENT_HOST = 'MODUS_AGENT_HOST'
const ENV_ORGANIZATION_ID = 'MODUS_ORGANIZATION_ID'
const ENV_TIMEOUT = 'MODUS_TIMEOUT'
const ENV_MAX_RETRIES = 'MODUS_MAX_RETRIES'
const KEY_PREFIX = 'modus_'

export function resolveApiKey(apiKey?: string): string {
  const key = apiKey ?? process.env[ENV_API_KEY]
  if (!key) {
    throw new AuthenticationError(
      `No API key provided. Pass apiKey or set the ${ENV_API_KEY} environment variable. ` +
        'Create a token at app.getmodus.com → Settings → API Tokens.',
    )
  }
  if (!key.startsWith(KEY_PREFIX)) {
    throw new AuthenticationError(
      `Invalid API key format. Modus API keys start with '${KEY_PREFIX}'. ` +
        'Create a token at app.getmodus.com → Settings → API Tokens.',
    )
  }
  return key
}

export function resolveBaseUrl(baseUrl?: string): string | undefined {
  return baseUrl ?? process.env[ENV_BASE_URL] ?? undefined
}

export function resolveAgentHost(agentHost?: string): string | undefined {
  return agentHost ?? process.env[ENV_AGENT_HOST] ?? undefined
}

export function resolveOrganizationId(organizationId?: string): string | undefined {
  const raw = organizationId ?? process.env[ENV_ORGANIZATION_ID]
  if (raw === undefined) return undefined
  const stripped = raw.trim()
  return stripped || undefined
}

export function resolveTimeoutMs(explicitMs?: number): number | undefined {
  if (explicitMs !== undefined) return explicitMs
  const raw = process.env[ENV_TIMEOUT]
  if (raw === undefined) return undefined
  const seconds = Number(raw)
  return Number.isFinite(seconds) ? seconds * 1000 : undefined
}

export function resolveMaxRetries(explicit?: number): number | undefined {
  if (explicit !== undefined) {
    if (explicit < 0) throw new Error(`max_retries must be >= 0, got ${explicit}`)
    return explicit
  }
  const raw = process.env[ENV_MAX_RETRIES]
  if (raw === undefined) return undefined
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

export function authHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` }
}
