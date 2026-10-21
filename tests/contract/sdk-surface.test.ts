import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Modus } from '../../src/index.js'
import { ModusManagement } from '../../src/management/index.js'
import { loadOpenApi } from './openapi-spec.js'

const CLIENTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const SURFACE_PATH = join(CLIENTS_DIR, 'sdk-surface.json')
const SCHEMA_PATH = join(CLIENTS_DIR, 'sdk-surface.schema.json')
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete'])

interface Exposure {
  surface: 'consumption' | 'management'
  resource: string[]
  bind?: Record<string, string>
  method: string
  returns?: string
  body?: { arg: string; type: string }
}

interface Operation {
  mode: 'custom' | 'generated' | 'excluded'
  exposures?: Exposure[]
  cli?: string
}

interface SdkSurface {
  types: Record<string, { ts: string; py: string }>
  operations: Record<string, Operation>
}

type Schema = Record<string, unknown>

const surface = JSON.parse(readFileSync(SURFACE_PATH, 'utf8')) as SdkSurface
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as Schema

function deref(root: Schema, ref: string): Schema {
  let target: unknown = root
  for (const part of ref.replace(/^#\//, '').split('/')) {
    target = (target as Record<string, unknown>)[part]
  }
  return target as Schema
}

/**
 * Validates the keyword subset `sdk-surface.schema.json` uses. Neither SDK ships a
 * JSON-Schema validator and the hints file must not add a dependency to get one.
 */
function schemaErrors(node: Schema, value: unknown, path: string): string[] {
  if (typeof node.$ref === 'string') return schemaErrors(deref(schema, node.$ref), value, path)
  if (Array.isArray(node.oneOf)) {
    const branches = (node.oneOf as Schema[]).map((sub) => schemaErrors(sub, value, path))
    const matched = branches.filter((errors) => errors.length === 0)
    if (matched.length === 1) return []
    if (matched.length > 1) return [`${path}: matched ${matched.length} oneOf branches, expected 1`]
    return [`${path}: matched no oneOf branch`, ...branches.flat()]
  }

  const errors: string[] = []
  if (node.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return [`${path}: expected an object`]
    }
    const entries = value as Record<string, unknown>
    const properties = (node.properties ?? {}) as Record<string, Schema>
    for (const key of (node.required as string[] | undefined) ?? []) {
      if (!(key in entries)) errors.push(`${path}: missing required property "${key}"`)
    }
    const minProperties = node.minProperties as number | undefined
    if (minProperties !== undefined && Object.keys(entries).length < minProperties) {
      errors.push(`${path}: expected at least ${minProperties} properties`)
    }
    for (const [key, child] of Object.entries(entries)) {
      if (properties[key]) {
        errors.push(...schemaErrors(properties[key], child, `${path}.${key}`))
      } else if (node.additionalProperties === false) {
        errors.push(`${path}: unknown property "${key}"`)
      } else if (node.additionalProperties) {
        errors.push(...schemaErrors(node.additionalProperties as Schema, child, `${path}.${key}`))
      }
    }
    return errors
  }
  if (node.type === 'array') {
    if (!Array.isArray(value)) return [`${path}: expected an array`]
    const minItems = node.minItems as number | undefined
    if (minItems !== undefined && value.length < minItems) {
      errors.push(`${path}: expected at least ${minItems} items`)
    }
    value.forEach((item, index) => {
      errors.push(...schemaErrors(node.items as Schema, item, `${path}[${index}]`))
    })
    return errors
  }
  if (node.type === 'string' && typeof value !== 'string') return [`${path}: expected a string`]
  if (Array.isArray(node.enum) && !node.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(node.enum)}`)
  }
  if (typeof node.pattern === 'string' && typeof value === 'string') {
    if (!new RegExp(node.pattern).test(value)) {
      errors.push(`${path}: ${JSON.stringify(value)} does not match ${node.pattern}`)
    }
  }
  return errors
}

function specOperationIds(): Set<string> {
  const openapi = loadOpenApi()
  const ids = new Set<string>()
  const paths = (openapi.paths ?? {}) as Record<string, Record<string, { operationId?: string }>>
  for (const pathItem of Object.values(paths)) {
    for (const [method, op] of Object.entries(pathItem)) {
      if (HTTP_METHODS.has(method) && op?.operationId) ids.add(op.operationId)
    }
  }
  return ids
}

function exposures(): [string, Exposure][] {
  return Object.entries(surface.operations).flatMap(([operationId, op]) =>
    (op.exposures ?? []).map((exposure) => [operationId, exposure] as [string, Exposure]),
  )
}

describe('sdk-surface.json coverage', () => {
  it('has an entry for every spec operation', () => {
    const missing = [...specOperationIds()].filter((id) => !(id in surface.operations)).sort()
    expect(missing, `Operations with no sdk-surface.json entry: ${missing.join(', ')}`).toEqual([])
  })

  it('has no stale entries', () => {
    const specIds = specOperationIds()
    const stale = Object.keys(surface.operations)
      .filter((id) => !specIds.has(id))
      .sort()
    expect(stale, `sdk-surface.json entries not in the spec: ${stale.join(', ')}`).toEqual([])
  })
})

describe('sdk-surface.json schema', () => {
  it('validates against the schema', () => {
    expect(schemaErrors(schema, surface, '$')).toEqual([])
  })

  // A negative test built on an already-invalid row would pass even with unknown-property
  // rejection switched off, so each one starts from a copy of a real row and changes one thing.
  function probeRow(): Record<string, unknown> {
    const real = Object.values(surface.operations).find((op) => op.exposures?.length)
    return structuredClone(real) as unknown as Record<string, unknown>
  }

  function errorsWithProbe(row: Record<string, unknown>): string {
    const probed = { ...surface, operations: { ...surface.operations, ProbeController_probe: row } }
    return schemaErrors(schema, probed, '$').join('\n')
  }

  it('accepts the unmodified probe row', () => {
    expect(errorsWithProbe(probeRow())).toBe('')
  })

  it('rejects an unknown property on an operation', () => {
    const row = probeRow()
    row.clii = 'scopes memories update'
    expect(errorsWithProbe(row)).toContain('unknown property "clii"')
  })

  it('rejects an unknown property on an exposure', () => {
    const row = probeRow()
    ;(row.exposures as Record<string, unknown>[])[0].resourse = ['scopes']
    expect(errorsWithProbe(row)).toContain('unknown property "resourse"')
  })

  it('names every referenced type in "types"', () => {
    const unknown = exposures()
      .flatMap(([operationId, exposure]) =>
        [exposure.returns, exposure.body?.type]
          .filter((name): name is string => Boolean(name))
          .filter((name) => !(name in surface.types))
          .map((name) => `${operationId}: ${name}`),
      )
      .sort()
    expect(unknown, `Types used by an exposure but absent from "types": ${unknown.join(', ')}`).toEqual([])
  })

  it('points every type at a module that exports it', () => {
    const SDK_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
    const missing = Object.entries(surface.types)
      .filter(([name, location]) => {
        const source = readFileSync(join(SDK_ROOT, location.ts), 'utf8')
        return !new RegExp(`export (type|interface|class|const) ${name}\\b`).test(source)
      })
      .map(([name, location]) => `${name} (${location.ts})`)
    expect(missing, `Types not exported from their declared module: ${missing.join(', ')}`).toEqual([])
  })
})

describe('sdk-surface.json exposures', () => {
  const roots: Record<Exposure['surface'], Record<string, unknown>> = {
    consumption: new Modus({ apiKey: 'modus_x' }) as unknown as Record<string, unknown>,
    management: new ModusManagement({ apiKey: 'modus_x' }) as unknown as Record<string, unknown>,
  }

  it('resolves every exposure to a real method', () => {
    const unresolved: string[] = []
    for (const [operationId, exposure] of exposures()) {
      const where = `${operationId}: ${exposure.surface}.${exposure.resource.join('.')}.${exposure.method}`
      let target: Record<string, unknown> | undefined = roots[exposure.surface]
      for (const [index, name] of exposure.resource.entries()) {
        const parent = target
        const next: unknown = parent?.[name]
        const isLast = index === exposure.resource.length - 1
        target =
          exposure.bind && isLast && typeof next === 'function'
            ? ((next as (id: string) => Record<string, unknown>).call(parent, '1') as Record<string, unknown>)
            : (next as Record<string, unknown> | undefined)
        if (!target) break
      }
      if (typeof target?.[exposure.method] !== 'function') unresolved.push(where)
    }
    expect(unresolved, `Exposures that do not resolve to a method: ${unresolved.join(' | ')}`).toEqual([])
  })
})
