import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete'])

export const OPENAPI_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/_generated/public-openapi.json',
)

export function loadOpenApi(): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(OPENAPI_PATH, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

export function resolveRef(openapi: Record<string, unknown>, node: Record<string, unknown>): Record<string, unknown> {
  const ref = node.$ref
  if (typeof ref !== 'string') return node
  let target: unknown = openapi
  for (const part of ref.replace(/^#\//, '').split('/')) {
    target = (target as Record<string, unknown>)[part]
  }
  return target as Record<string, unknown>
}

export function schemaProperties(
  openapi: Record<string, unknown>,
  schema: Record<string, unknown>,
): Set<string> {
  const resolved = resolveRef(openapi, schema)
  const props = new Set<string>(Object.keys(resolved.properties ?? {}))
  for (const combinator of ['allOf', 'anyOf', 'oneOf'] as const) {
    const subs = resolved[combinator]
    if (!Array.isArray(subs)) continue
    for (const sub of subs) {
      if (sub && typeof sub === 'object') {
        for (const key of schemaProperties(openapi, sub as Record<string, unknown>)) {
          props.add(key)
        }
      }
    }
  }
  return props
}

export function requestBodyProperties(
  openapi: Record<string, unknown>,
  operationId: string,
): Set<string> {
  const paths = openapi.paths as Record<string, Record<string, unknown>> | undefined
  if (!paths) return new Set()
  for (const pathItem of Object.values(paths)) {
    for (const [method, op] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !op || typeof op !== 'object') continue
      if ((op as { operationId?: string }).operationId !== operationId) continue
      const rb = (op as { requestBody?: Record<string, unknown> }).requestBody
      if (!rb) return new Set()
      const resolved = resolveRef(openapi, rb)
      const props = new Set<string>()
      const content = resolved.content as Record<string, { schema?: Record<string, unknown> }> | undefined
      for (const media of Object.values(content ?? {})) {
        if (media?.schema) {
          for (const key of schemaProperties(openapi, media.schema)) props.add(key)
        }
      }
      return props
    }
  }
  throw new Error(`operationId ${operationId} not found in OpenAPI spec`)
}

export function operationHasRequestBody(
  openapi: Record<string, unknown>,
  operationId: string,
): boolean {
  const paths = openapi.paths as Record<string, Record<string, unknown>> | undefined
  if (!paths) return false
  for (const pathItem of Object.values(paths)) {
    for (const [method, op] of Object.entries(pathItem)) {
      if (
        HTTP_METHODS.has(method) &&
        op &&
        typeof op === 'object' &&
        (op as { operationId?: string }).operationId === operationId
      ) {
        return Boolean((op as { requestBody?: unknown }).requestBody)
      }
    }
  }
  return false
}

export function operationResponseSchemaName(
  openapi: Record<string, unknown>,
  operationId: string,
): string {
  const paths = openapi.paths as Record<string, Record<string, unknown>> | undefined
  if (!paths) throw new Error('missing paths')
  for (const pathItem of Object.values(paths)) {
    for (const [method, op] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !op || typeof op !== 'object') continue
      if ((op as { operationId?: string }).operationId !== operationId) continue
      const responses = (op as { responses?: Record<string, unknown> }).responses ?? {}
      const ok = (responses['200'] ?? responses['201']) as
        | { content?: { 'application/json'?: { schema?: { $ref?: string } } } }
        | undefined
      if (!ok) throw new Error(`${operationId}: no 200/201 response`)
      const ref = ok.content?.['application/json']?.schema?.$ref ?? ''
      if (!ref.startsWith('#/components/schemas/')) {
        throw new Error(`${operationId}: unexpected response schema ref ${ref}`)
      }
      return ref.split('/').pop()!
    }
  }
  throw new Error(`operationId ${operationId} not found in OpenAPI spec`)
}

export function listResponseArrayKeys(
  openapi: Record<string, unknown>,
  schemaName: string,
): Set<string> {
  const schemas = openapi.components as { schemas?: Record<string, Record<string, unknown>> }
  const schema = schemas?.schemas?.[schemaName]
  if (!schema) throw new Error(`schema ${schemaName} not found`)
  const props = schema.properties as Record<string, { type?: string }> | undefined
  const required = new Set((schema.required as string[] | undefined) ?? [])
  const arrayKeys = new Set<string>()
  for (const [name, prop] of Object.entries(props ?? {})) {
    if (prop.type === 'array' && required.has(name)) arrayKeys.add(name)
  }
  return arrayKeys
}
