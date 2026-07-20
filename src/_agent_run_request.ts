import { randomUUID } from 'node:crypto'

/** Mint or reuse a non-empty sessionId for agent-host runs. */
export function resolveAgentRunSessionId(sessionId?: string | null): string {
  if (typeof sessionId === 'string' && sessionId.trim()) return sessionId.trim()
  return randomUUID()
}
