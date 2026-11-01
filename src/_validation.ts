import type { OperationId } from './_generated/operations.js'
import { WRITE_BODY_ALLOWED_KEYS } from './_generated/write-body-keys.js'
import { ValidationError } from './_exceptions.js'

export const DEFAULT_MAX_PAGE_SIZE = 200

export function validatePageSize(pageSize: number, maxPageSize?: number): void {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new ValidationError(`page_size must be a positive int, got ${pageSize}`)
  }
  if (maxPageSize !== undefined && pageSize > maxPageSize) {
    throw new ValidationError(`page_size must be <= ${maxPageSize}, got ${pageSize}`)
  }
}

/**
 * Reject ids that would not address one resource: a number that is not a whole number, a blank
 * string, or a dot segment the URL would collapse onto the parent.
 */
export function validateId(resourceId: number | string, name = 'id'): void {
  if (typeof resourceId === 'number') {
    if (!Number.isInteger(resourceId)) throw new ValidationError(`${name} must be an integer, got ${resourceId}`)
    return
  }
  if (!resourceId.trim()) throw new ValidationError(`${name} must be a non-empty string or int`)
  if (resourceId === '.' || resourceId === '..') {
    throw new ValidationError(`${name} must not be ${JSON.stringify(resourceId)}`)
  }
}

// The canonical model ids the agent host accepts for `config.model`.
export const CHAT_MODELS = [
  'claude-sonnet-5',
  'claude-sonnet-5.5',
  'claude-sonnet-4.6',
  'claude-opus-4.8',
  'claude-opus-5.5',
  'gpt-5.2',
  'gpt-5.5',
  'gpt-5-mini',
  'gpt-5.6-luna',
  'gpt-6-luna',
  'gpt-oss-120b',
  'gpt-oss-20b',
  'qwen3-235b-a22b-2507',
  'qwen3-coder',
  'qwen3-32b',
  'deepseek-chat-v3.1',
  'deepseek-v4-pro',
  'deepseek-v4-flash-latest',
  'deepseek-v4.1-flash-1017',
  'minimax-m2.7',
  'llama-4-maverick',
  'llama-4-scout',
  'llama-3.3-70b-instruct',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'grok-4.3-fast',
  'grok-4.3',
  'grok-4.7',
  'kimi-k3',
] as const

const ALLOWED_CHAT_MODELS: ReadonlySet<string> = new Set(CHAT_MODELS)

export function validateChatModel(model: string): void {
  if (!ALLOWED_CHAT_MODELS.has(model)) {
    const supported = [...ALLOWED_CHAT_MODELS].sort().join(', ')
    throw new ValidationError(`Unsupported model ${JSON.stringify(model)}. Choose one of: ${supported}.`)
  }
}

export function assertWriteBodyKeys(operationId: OperationId, body: unknown): void {
  const allowed = WRITE_BODY_ALLOWED_KEYS[operationId]
  if (allowed === undefined) return
  if (body === undefined || body === null) return
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError(`Request body must be a plain object for ${operationId}`)
  }
  const allowedSet = new Set(allowed)
  const extra = Object.keys(body as Record<string, unknown>).filter((k) => !allowedSet.has(k))
  if (extra.length > 0) {
    throw new ValidationError(
      `${operationId}: disallowed request body field(s): ${extra.sort().join(', ')}`,
    )
  }
}
