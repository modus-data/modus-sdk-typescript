import { resolveServiceBaseUrl } from './_config.js'
import { OPERATIONS, type OperationId, type OperationSpec } from './_generated/operations.js'
import type { HttpClient } from './_http.js'

export function getOperation(operationId: string): OperationSpec {
  if (!(operationId in OPERATIONS)) {
    throw new Error(
      `Unknown API operation ${JSON.stringify(operationId)}. Upgrade @modus/sdk or report a version mismatch.`,
    )
  }
  return OPERATIONS[operationId as OperationId]
}

function formatPath(template: string, pathParams: Record<string, unknown>): string {
  return template
    .split('/')
    .map((segment) => {
      if (!segment.startsWith('{') || !segment.endsWith('}')) return segment
      const key = segment.slice(1, -1)
      if (!(key in pathParams)) {
        throw new Error(`Missing path parameter ${JSON.stringify(key)} for ${JSON.stringify(template)}`)
      }
      return encodeURIComponent(String(pathParams[key]))
    })
    .join('/')
}

export function operationBaseUrl(http: HttpClient, operation: OperationSpec): string {
  return resolveServiceBaseUrl(http.config, operation.service, operation.serverUrl)
}

export function formatOperationPath(
  operationId: OperationId,
  pathParams: Record<string, unknown> = {},
): string {
  return formatPath(getOperation(operationId).path, pathParams)
}

type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number)[]

export async function invokeOperation(
  http: HttpClient,
  operationId: OperationId,
  options: {
    pathParams?: Record<string, unknown>
    query?: Record<string, QueryValue>
    jsonBody?: unknown
    headers?: Record<string, string>
  } = {},
): Promise<unknown> {
  const op = getOperation(operationId)
  const path = formatPath(op.path, options.pathParams ?? {})
  const params = options.query
  const requestOptions = {
    baseUrl: operationBaseUrl(http, op),
    headers: options.headers,
  }

  switch (op.method) {
    case 'GET':
      return http.get(path, params, requestOptions)
    case 'POST':
      return http.post(path, options.jsonBody, requestOptions)
    case 'PATCH':
      return http.patch(path, options.jsonBody, params, requestOptions)
    case 'DELETE':
      return http.delete(path, requestOptions)
    default:
      throw new Error(`Unsupported HTTP method ${JSON.stringify(op.method)}`)
  }
}
