import type { OperationId } from './_generated/operations.js'
import { WRITE_BODY_ALLOWED_KEYS } from './_generated/write-body-keys.js'
import { ValidationError } from './_exceptions.js'

export const DEFAULT_MAX_PAGE_SIZE = 200

export function validatePageSize(pageSize: number, maxPageSize?: number): void {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(`page_size must be a positive int, got ${pageSize}`)
  }
  if (maxPageSize !== undefined && pageSize > maxPageSize) {
    throw new Error(`page_size must be <= ${maxPageSize}, got ${pageSize}`)
  }
}

export function validateId(resourceId: number | string, name = 'id'): void {
  if (typeof resourceId === 'string' && !resourceId.trim()) {
    throw new Error(`${name} must be a non-empty string or int`)
  }
}

// Keep in sync with SkillChatRequestDto.model in the public API contract.
const ALLOWED_CHAT_MODELS = new Set([
  'claude-sonnet-5',
  'claude-sonnet-4.6',
  'claude-opus-4.8',
  'gpt-5.2',
  'gpt-5.5',
  'gpt-5-mini',
  'gpt-oss-120b',
  'gpt-oss-20b',
  'qwen3-235b-a22b-2507',
  'qwen3-coder',
  'qwen3-32b',
  'deepseek-chat-v3.1',
  'minimax-m2.7',
  'llama-4-maverick',
  'llama-4-scout',
  'llama-3.3-70b-instruct',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'grok-4.3-fast',
  'grok-4.3',
])

export function validateChatModel(model: string): void {
  if (!ALLOWED_CHAT_MODELS.has(model)) {
    const supported = [...ALLOWED_CHAT_MODELS].sort().join(', ')
    throw new Error(`Unsupported model ${JSON.stringify(model)}. Choose one of: ${supported}.`)
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
