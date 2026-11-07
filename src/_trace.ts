import { randomBytes } from 'node:crypto'

const TRACEPARENT = /^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/

export function newTraceId(): string {
  return randomBytes(16).toString('hex')
}

/**
 * A W3C `traceparent` for one request of trace `traceId`, each with its own span id. Not
 * sampled: the SDK records no spans, so the server's own sampling decides.
 */
export function traceparent(traceId: string = newTraceId()): string {
  return `00-${traceId}-${randomBytes(8).toString('hex')}-00`
}

/** The trace id a `traceparent` names, or undefined when it is not one. */
export function traceIdOf(value: string | undefined): string | undefined {
  return value ? TRACEPARENT.exec(value)?.[1] : undefined
}

/** A header's value, matching its name case-insensitively as HTTP does. */
export function headerValue(headers: Readonly<Record<string, string>> | undefined, name: string): string | undefined {
  const lower = name.toLowerCase()
  return Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === lower)?.[1]
}
