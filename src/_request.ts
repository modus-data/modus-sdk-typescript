import type { ModusConfig } from './_config.js'
import type { OperationId } from './_generated/operations.js'
import type { HttpClient } from './_http.js'
import { invokeOperation } from './_openapi-invoke.js'
import { withRetry } from './_retry.js'
import { headerValue, newTraceId, traceparent } from './_trace.js'
import { assertWriteBodyKeys } from './_validation.js'

export async function invokeWithRetry(
  config: ModusConfig,
  http: HttpClient,
  operationId: OperationId,
  options: {
    pathParams?: Record<string, unknown>
    query?: Record<string, string | number | boolean | readonly (string | number)[] | undefined | null>
    jsonBody?: unknown
    headers?: Record<string, string>
  } = {},
): Promise<unknown> {
  if (options.jsonBody !== undefined) {
    assertWriteBodyKeys(operationId, options.jsonBody)
  }
  // One trace per call, kept across its re-sends, unless the caller sends their own traceparent.
  const own = headerValue(config.defaultHeaders, 'traceparent') ?? headerValue(options.headers, 'traceparent')
  const traceId = own === undefined ? newTraceId() : undefined
  return withRetry(
    (resend) =>
      invokeOperation(http, operationId, {
        ...options,
        headers: {
          ...(traceId ? { traceparent: traceparent(traceId) } : {}),
          ...(resend > 0 ? { 'X-Modus-Retry-Attempt': String(resend) } : {}),
          ...options.headers,
        },
      }),
    config.maxRetries,
    { retryNotFoundOnDeploy: operationId.endsWith('_deploy') },
  )
}

export function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter((entry): entry is [string, unknown] => entry[1] !== undefined),
  )
}

export function asRecord(data: unknown): Record<string, unknown> {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  throw new Error(`Expected object response, got ${typeof data}`)
}
