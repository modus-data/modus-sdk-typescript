import type { CHAT_MODELS } from '../_validation.js'
import type { ApprovalRequiredEvent } from './runs.js'

/**
 * Canonical model id accepted by Modus chat APIs.
 *
 * Pass as `model` to `client.modus.chat(...)`, `client.scopes.chat(...)`
 * or `client.workflows.chat(...)`. An unsupported value fails client-side
 * validation before the request is sent.
 *
 * Allowed values:
 * - `claude-sonnet-5`, `claude-sonnet-5.5`, `claude-sonnet-4.6`, `claude-opus-4.8`, `claude-opus-5.5`, `claude-haiku-5.5`
 * - `gpt-5.2`, `gpt-5.5`, `gpt-5-mini`, `gpt-5.6-luna`, `gpt-6-luna`, `gpt-oss-120b`, `gpt-oss-20b`
 * - `qwen3-235b-a22b-2507`, `qwen3-coder`, `qwen3-32b`
 * - `deepseek-chat-v3.1`, `deepseek-v4-pro`, `deepseek-v4-flash-latest`, `deepseek-v4.1-flash-1017`, `minimax-m2.7`
 * - `llama-4-maverick`, `llama-4-scout`, `llama-3.3-70b-instruct`
 * - `gemini-3.1-pro-preview`, `gemini-3-flash-preview`, `gemini-3.8-flash`
 * - `grok-4.3-fast`, `grok-4.3`, `grok-4.7`, `kimi-k3`
 *
 * @example
 * ```ts
 * const result = await client.modus.chat('Summarize open tickets', {
 *   model: 'claude-sonnet-5.5',
 * })
 * ```
 */
export type ChatModel = (typeof CHAT_MODELS)[number]

/**
 * Chat response: final assistant text plus `threadId` for follow-ups.
 */
export interface ChatResult {
  /** Final assistant text for the run. */
  content: string
  /** Conversation thread id for follow-up messages. */
  threadId: string
  /** Opaque run id for logging / correlation. */
  runId: string
  /** Set when the run stopped for a decision; continue with `ChatSession.resume`. */
  approval?: ApprovalRequiredEvent
}
