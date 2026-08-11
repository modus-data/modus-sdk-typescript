import type { components } from '../_generated/v1.js'

/**
 * Canonical model id accepted by Modus chat APIs.
 *
 * Pass as `model` to `client.modus.chat(...)`, `client.scopes.chat(...)`,
 * and the matching stream methods. An unsupported value fails client-side
 * validation before the request is sent.
 *
 * Allowed values:
 * - `claude-sonnet-5`, `claude-sonnet-4.6`, `claude-opus-4.8`
 * - `gpt-5.2`, `gpt-5.5`, `gpt-5-mini`, `gpt-oss-120b`, `gpt-oss-20b`
 * - `qwen3-235b-a22b-2507`, `qwen3-coder`, `qwen3-32b`
 * - `deepseek-chat-v3.1`, `deepseek-v4-pro`, `deepseek-v4-flash-latest`, `minimax-m2.7`
 * - `llama-4-maverick`, `llama-4-scout`, `llama-3.3-70b-instruct`
 * - `gemini-3.1-pro-preview`, `gemini-3-flash-preview`
 * - `grok-4.3-fast`, `grok-4.3`
 *
 * @example
 * ```ts
 * const result = await client.modus.chat('Summarize open tickets', {
 *   model: 'claude-sonnet-4.6',
 * })
 * ```
 */
export type ChatModel = components['schemas']['SkillChatRequestDto']['model']

/**
 * Chat request body (`message` + required `model`).
 *
 * Prefer `client.modus.chat(...)` / `client.scopes.chat(...)` — they take these
 * fields as method arguments so you rarely construct this type yourself.
 */
export interface ChatRequest {
  /** User message sent to the skill / Modus. */
  message: string
  /** Canonical model id for this run (required). See {@link ChatModel}. */
  model: ChatModel
}

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
}
