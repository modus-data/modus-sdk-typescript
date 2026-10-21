import { describe, expect, it } from 'vitest'
import { emitResourceFiles } from '../../../scripts/emit-sdk-resources.mjs'

/**
 * Templates emitted from a minimal in-memory hints + spec pair, so a case can be covered without
 * a matching real operation. The pilot's own two files are covered end to end by
 * generated-wiring.test.ts; these assert the emitted text for shapes the pilot does not use.
 */

interface SpecParameter {
  name: string
  in: 'path' | 'query'
  description?: string
  required?: boolean
  schema?: Record<string, unknown>
}

const THING_ID: SpecParameter = { name: 'thingId', in: 'path', description: 'Thing id.' }

/** Component schemas the cases below point `$ref` parameter schemas at. */
const COMPONENTS = {
  schemas: {
    ThingView: { type: 'string', enum: ['active', 'draft'] },
    ThingDepth: { $ref: '#/components/schemas/ThingDepthValue' },
    ThingDepthValue: { type: 'integer' },
    ThingFilter: { type: 'object', properties: { owner: { type: 'string' } } },
  },
}

function queryParam(
  name: string,
  description?: string,
  schema: Record<string, unknown> = { type: 'string' },
): SpecParameter {
  return { name, in: 'query', schema, ...(description ? { description } : {}) }
}

function requiredQueryParam(
  name: string,
  description?: string,
  schema: Record<string, unknown> = { type: 'string' },
): SpecParameter {
  return { ...queryParam(name, description, schema), required: true }
}

function updateSpec(parameters: SpecParameter[], responseDescription = '', description = 'Updates one thing.') {
  return {
    components: COMPONENTS,
    paths: {
      '/api/v1/things/{thingId}': {
        patch: {
          operationId: 'ThingsController_update',
          summary: 'Update a thing',
          description,
          'x-modus-service': 'modus-api',
          parameters,
          responses: { 200: { description: responseDescription } },
        },
      },
    },
  }
}

type QueryHint = string | { name: string; ts: string; py: string }

const TYPES = {
  Thing: { ts: 'src/types/things.ts', py: 'modus.types.things' },
  ThingView: { ts: 'src/types/things.ts', py: 'modus.types.things' },
}

function updateHints(query: QueryHint[], exposure: Record<string, unknown> = {}) {
  return {
    types: TYPES,
    operations: {
      ThingsController_update: {
        mode: 'generated',
        exposures: [
          {
            surface: 'management',
            resource: ['things'],
            method: 'update',
            query,
            returns: 'Thing',
            ...exposure,
          },
        ],
        cli: 'things update',
      },
    },
  }
}

function emitUpdate(
  query: QueryHint[],
  parameters: SpecParameter[],
  responseDescription = '',
  exposure: Record<string, unknown> = {},
): string {
  const files = emitResourceFiles(
    updateHints(query, exposure),
    updateSpec(parameters, responseDescription),
  )
  expect(files).toHaveLength(1)
  expect(files[0].path).toBe('src/_generated/resources/management/things.ts')
  return files[0].source
}

function listSpec(parameters: SpecParameter[], description = '') {
  return {
    components: COMPONENTS,
    paths: {
      '/api/v1/things': {
        get: {
          operationId: 'ThingsController_list',
          summary: 'List things',
          description,
          'x-modus-service': 'modus-api',
          parameters,
          responses: { 200: { description: '' } },
        },
      },
    },
  }
}

function listHints(query: QueryHint[]) {
  return {
    types: TYPES,
    operations: {
      ThingsController_list: {
        mode: 'generated',
        exposures: [
          { surface: 'management', resource: ['things'], method: 'list', query, returns: 'Thing' },
        ],
        pagination: { items: 'things' },
        cli: 'things list',
      },
    },
  }
}

function emitList(query: QueryHint[], parameters: SpecParameter[]): string {
  return emitResourceFiles(listHints(query), listSpec(parameters))[0].source
}

describe('resource-specific declarative limits and validation', () => {
  it('opts into an object response guard without changing unguarded exposures', () => {
    const guarded = emitUpdate([], [THING_ID], '', { tsResponseGuard: 'record' })
    expect(guarded).toContain('return asRecord(data) as unknown as Thing')
    expect(guarded).toContain("import { asRecord, invokeWithRetry } from '../../../_request.js'")
    const unguarded = emitUpdate([], [THING_ID])
    expect(unguarded).toContain('return data as Thing')
    expect(unguarded).not.toContain('asRecord')
  })

  it('guards the response envelope before unwrapping an array', () => {
    const spec = updateSpec([THING_ID])
    Object.assign(spec.paths['/api/v1/things/{thingId}'].patch.responses[200], {
      content: { 'application/json': { schema: {
        type: 'object', properties: { things: { type: 'array', items: { type: 'object' } } },
      } } },
    })
    const [{ source }] = emitResourceFiles(
      updateHints([], { tsResponseGuard: 'record', unwrap: 'things' }), spec,
    )
    expect(source).toContain('return asRecord(data).things as Thing[]')
  })

  it('preserves page defaults and maximums on each exposure', () => {
    const hints = listHints([])
    Object.assign(hints.operations.ThingsController_list.exposures[0], {
      pageSize: { default: 50, max: 200 },
    })
    const source = emitResourceFiles(hints, listSpec([]))[0].source
    expect(source).toContain('options.pageSize ?? 50')
    expect(source).toContain('validatePageSize(pageSize, 200)')
    expect(source).toContain('Items per page. Defaults to 50.')
  })

  it('retains public argument names in ID errors', () => {
    const source = emitUpdate([], [THING_ID], '', { idValidation: { argumentNames: true } })
    expect(source).toContain("validateId(thingId, 'thingId')")
  })

  it('leaves factory-validated bound IDs alone while validating positional IDs', () => {
    const hints = updateHints([], {
      bind: { thingId: 'thingId' },
      idValidation: { argumentNames: true, bound: false },
    })
    const spec = updateSpec([THING_ID, { name: 'childId', in: 'path' }])
    const source = emitResourceFiles(hints, {
      ...spec,
      paths: { '/api/v1/things/{thingId}/children/{childId}': spec.paths['/api/v1/things/{thingId}'] },
    })[0].source
    expect(source).not.toContain('validateId(this.thingId')
    expect(source).toContain("validateId(childId, 'childId')")
    expect(source).toContain('pathParams: { thingId: this.thingId, childId }')
  })
})

describe('public operation names in generated documentation', () => {
  it.each([false, true])('resolves custom method references on the same exposure (paginated=%s)', (paginated) => {
    const hints = paginated ? listHints(['source']) : updateHints(['source'])
    Object.assign(hints.operations, {
      ThingsController_createSlot: {
        mode: 'custom',
        exposures: [
          { surface: 'consumption', resource: ['things'], method: 'consumeSlot' },
          { surface: 'management', resource: ['otherThings'], method: 'otherSlot' },
          { surface: 'management', resource: ['things'], method: 'allocateSlot', pyMethod: 'reserve_slot' },
        ],
      },
    })
    const description = 'Use `createSlot()` to reserve a slot.'
    const parameters = [queryParam('source', 'Source returned by `createSlot`.')]
    const spec = paginated ? listSpec(parameters, description) : updateSpec(parameters, description, description)
    const [{ source }] = emitResourceFiles(hints, spec)
    expect(source).toContain('Use `allocateSlot()` to reserve a slot.')
    expect(source).toContain('Source returned by `allocateSlot`.')
    expect(source).not.toContain('`createSlot')
    expect(source).not.toContain('consumeSlot')
    expect(source).not.toContain('otherSlot')
    expect(source).not.toContain('reserve_slot')
  })
})

describe('emit-sdk-resources query templates', () => {
  it('forwards an ordinary optional query field under its wire name', () => {
    const source = emitUpdate(['view'], [THING_ID, queryParam('view', 'Which revision to read.')])

    expect(source).toContain(
      ['  async update(', '    thingId: string,', '    options: { view?: string } = {},', '  ): Promise<Thing> {'].join('\n'),
    )
    expect(source).toContain('query: { view: options.view },')
    expect(source).toContain('@param options.view - Which revision to read.')
    // No updateMask in the list, so its helper must not be imported.
    expect(source).not.toContain('updateMaskQuery')
  })

  it('forwards several ordinary query fields in hint order', () => {
    const source = emitUpdate(
      ['view', 'search'],
      [THING_ID, queryParam('view'), queryParam('search')],
    )

    expect(source).toContain('options: { view?: string; search?: string } = {}')
    expect(source).toContain('query: { view: options.view, search: options.search },')
  })

  it('mixes updateMask with ordinary query fields', () => {
    const source = emitUpdate(
      ['updateMask', 'view'],
      [THING_ID, queryParam('updateMask', 'Fields to update.'), queryParam('view')],
    )

    expect(source).toContain('options: { updateMask?: string; view?: string } = {}')
    expect(source).toContain(
      'query: { ...updateMaskQuery(options.updateMask), view: options.view },',
    )
    expect(source).toContain("import { updateMaskQuery } from '../../../_query.js'")
  })

  it('keeps updateMaskQuery bare when updateMask is the only query field', () => {
    const source = emitUpdate(
      ['updateMask'],
      [THING_ID, queryParam('updateMask', 'Fields to update.')],
    )

    expect(source).toContain('query: updateMaskQuery(options.updateMask),')
    expect(source).not.toContain('...updateMaskQuery')
  })

  it('emits no query object and no options argument when no query field is exposed', () => {
    const source = emitUpdate([], [THING_ID])

    expect(source).toContain('async update(thingId: string): Promise<Thing>')
    expect(source).not.toContain('query:')
  })

  it('keeps a query field the spec requires required, and drops the options default', () => {
    const source = emitUpdate(
      ['since', 'view'],
      [THING_ID, requiredQueryParam('since', 'Window start.'), queryParam('view')],
    )

    expect(source).toContain(
      [
        '  async update(',
        '    thingId: string,',
        '    options: { since: string; view?: string },',
        '  ): Promise<Thing> {',
      ].join('\n'),
    )
    expect(source).toContain('query: { since: options.since, view: options.view },')
  })

  it('keeps the options argument required when every query field is required', () => {
    const source = emitUpdate(
      ['since', 'until'],
      [THING_ID, requiredQueryParam('since'), requiredQueryParam('until')],
    )

    expect(source).toContain('options: { since: string; until: string },')
    expect(source).not.toContain('options: { since: string; until: string } = {}')
  })

  it('refuses a required filter on a paginated method', () => {
    expect(() => emitList(['since'], [requiredQueryParam('since')])).toThrow(
      /ThingsController_list \(things\.list\): query parameter "since" is required/,
    )
  })

  // updateMaskQuery owns the non-empty check that inlining the argument would skip.
  it('routes a required updateMask through the helper instead of inlining it', () => {
    const source = emitUpdate(
      ['updateMask'],
      [THING_ID, requiredQueryParam('updateMask', 'Fields to update.')],
    )

    expect(source).toContain('options: { updateMask: string },')
    expect(source).toContain('query: updateMaskQuery(options.updateMask),')
    expect(source).toContain("import { updateMaskQuery } from '../../../_query.js'")
  })

  it('keeps a required updateMask on the helper beside another required filter', () => {
    const source = emitUpdate(
      ['since', 'updateMask'],
      [THING_ID, requiredQueryParam('since'), requiredQueryParam('updateMask')],
    )

    expect(source).toContain('options: { since: string; updateMask: string },')
    expect(source).toContain(
      'query: { since: options.since, ...updateMaskQuery(options.updateMask) },',
    )
  })
})

describe('emit-sdk-resources query parameter types', () => {
  it('types a plain method query field from its spec schema', () => {
    const source = emitUpdate(
      ['managerId', 'archived'],
      [
        THING_ID,
        queryParam('managerId', 'Manager id.', { type: 'integer' }),
        queryParam('archived', undefined, { type: 'boolean' }),
      ],
    )

    expect(source).toContain('options: { managerId?: number; archived?: boolean } = {}')
  })

  it('types a paginated filter and the record it is collected into', () => {
    const source = emitList(
      ['managerId'],
      [queryParam('managerId', 'Manager id.', { type: 'integer' })],
    )

    expect(source).toContain(['    pageToken?: string', '    managerId?: number'].join('\n'))
    expect(source).toContain(
      ['    pageToken: string | undefined,', '    managerId?: number,'].join('\n'),
    )
    expect(source).toContain('const extra: Record<string, number> = {}')
  })

  it('widens the filter record to every scalar the filters use', () => {
    const source = emitList(
      ['search', 'managerId'],
      [queryParam('search'), queryParam('managerId', undefined, { type: 'integer' })],
    )

    expect(source).toContain('const extra: Record<string, string | number> = {}')
  })

  it('keeps a string enum a string', () => {
    const source = emitList(
      ['state'],
      [queryParam('state', undefined, { type: 'string', enum: ['live', 'draft'] })],
    )

    expect(source).toContain('    state?: string')
  })

  it('refuses a query field no scalar describes', () => {
    expect(() =>
      emitList(['tags'], [queryParam('tags', undefined, { type: 'array', items: {} })]),
    ).toThrow(/ThingsController_list \(things\.list\): query parameter "tags"/)
  })

  it('refuses a query field the spec does not declare', () => {
    expect(() => emitUpdate(['ghost'], [THING_ID])).toThrow(/query parameter "ghost"/)
  })

  it('resolves a registered $ref query schema to its public name', () => {
    const source = emitUpdate(
      ['view'],
      [THING_ID, queryParam('view', 'Which revision to read.', { $ref: '#/components/schemas/ThingView' })],
    )

    expect(source).toContain('options: { view?: ThingView } = {}')
  })

  it('follows a chain of $refs', () => {
    const source = emitList(
      ['depth'],
      [queryParam('depth', undefined, { $ref: '#/components/schemas/ThingDepth' })],
    )

    expect(source).toContain('    depth?: number')
    expect(source).toContain('const extra: Record<string, number> = {}')
  })

  it('refuses a $ref that resolves to an object, naming the operation and parameter', () => {
    expect(() =>
      emitList(['filter'], [queryParam('filter', undefined, { $ref: '#/components/schemas/ThingFilter' })]),
    ).toThrow(/ThingsController_list \(things\.list\): query parameter "filter"/)
  })

  it('refuses a $ref no component schema defines', () => {
    expect(() =>
      emitUpdate(['view'], [THING_ID, queryParam('view', undefined, { $ref: '#/components/schemas/Absent' })]),
    ).toThrow(/query parameter "view".*Absent/s)
  })
})

describe('emit-sdk-resources declared argument types', () => {
  it('infers named paginated filters through a chain of schema refs', () => {
    const spec = listSpec([queryParam('view', undefined, { $ref: '#/components/schemas/ViewAlias' })])
    spec.components = { schemas: { ...COMPONENTS.schemas } }
    Object.assign(spec.components.schemas, { ViewAlias: { $ref: '#/components/schemas/ThingView' } })
    const source = emitResourceFiles(listHints(['view']), spec)[0].source
    expect(source).toContain('    view?: ThingView')
    expect(source).toContain('const extra: Record<string, string> = {}')
    expect(source).toContain('ThingView')
  })

  it.each(['string', 'boolean'])('rejects the scalar override %s for a numeric query', (type) => {
    expect(() => emitList([{ name: 'depth', ts: type, py: 'str' }], [queryParam('depth', undefined, { type: 'integer' })]))
      .toThrow(/depth.*disagrees with.*spec scalar/)
  })

  it('rejects a named string schema overriding a numeric query', () => {
    expect(() => emitList([{ name: 'depth', ts: 'ThingView', py: 'ThingView' }], [queryParam('depth', undefined, { type: 'integer' })]))
      .toThrow(/depth.*disagrees with.*spec scalar/)
  })
  it('types a query argument from the hint and imports the named type', () => {
    const source = emitUpdate(
      [{ name: 'view', ts: 'ThingView', py: 'ThingView' }],
      [THING_ID, queryParam('view', 'Which revision to read.', {
        type: 'string',
        enum: ['active', 'draft'],
      })],
    )

    expect(source).toContain('options: { view?: ThingView } = {}')
    expect(source).toContain("import type { Thing, ThingView } from '../../../types/things.js'")
    expect(source).toContain('query: { view: options.view },')
  })

  it('types a paginated filter from the hint without importing a scalar', () => {
    const source = emitList(
      [{ name: 'managerId', ts: 'number', py: 'int' }],
      [queryParam('managerId', 'Manager id.', { type: 'number' })],
    )

    expect(source).toContain('    managerId?: number')
    expect(source).not.toContain("import type { number }")
  })

  // The filter record holds what goes on the wire, which a declared public type does not change.
  it('collects the filter record from the spec scalars, not the declared types', () => {
    const source = emitList(
      [{ name: 'view', ts: 'ThingView', py: 'ThingView' }, 'search'],
      [
        queryParam('view', undefined, { type: 'string', enum: ['active', 'draft'] }),
        queryParam('search'),
      ],
    )

    expect(source).toContain('    view?: ThingView')
    expect(source).toContain('const extra: Record<string, string> = {}')
  })

  it('refuses a declared type that is neither a named type nor a scalar', () => {
    expect(() =>
      emitUpdate([{ name: 'view', ts: 'ThingVue', py: 'ThingView' }], [THING_ID, queryParam('view')]),
    ).toThrow(/query parameter "view": declared type "ThingVue"/)
  })

  it('still refuses a query parameter the wire cannot carry, declared type or not', () => {
    expect(() =>
      emitList(
        [{ name: 'tags', ts: 'string', py: 'str' }],
        [queryParam('tags', undefined, { type: 'array', items: {} })],
      ),
    ).toThrow(/query parameter "tags"/)
  })

  it('names a positional path argument and types it as an id', () => {
    const source = emitUpdate([], [THING_ID], '', { ids: { thingId: 'thingRef' } })

    expect(source).toContain('async update(thingRef: number | string): Promise<Thing> {')
    expect(source).toContain("validateId(thingRef, 'thing_ref')")
    expect(source).toContain('pathParams: { thingId: thingRef },')
  })

  it('refuses an id for something that is not a positional path parameter', () => {
    expect(() => emitUpdate([], [THING_ID], '', { ids: { ghost: 'ghostRef' } })).toThrow(
      /"ids" names "ghost", which is not a positional path parameter/,
    )
  })

  it('ignores the Python name of a type', () => {
    const hints = updateHints([])
    hints.types = { ...TYPES, Thing: { ...TYPES.Thing, pyName: 'Thingy' } }
    const source = emitResourceFiles(hints, updateSpec([THING_ID]))[0].source

    expect(source).toContain("import type { Thing } from '../../../types/things.js'")
    expect(source).not.toContain('Thingy')
  })
})

describe('authored resource examples', () => {
  it.each([false, true])('preserves code fences and line breaks in examples (paginated=%s)', (paginated) => {
    const hints = paginated ? listHints([]) : updateHints([])
    const operation = Object.values(hints.operations)[0]
    Object.assign(operation.exposures[0], { examples: { ts: ['```ts\nconst result = await client.things.get(\n  "thing-1",\n)\n```', '```ts\nconsole.log(result)\n```'] } })
    const source = emitResourceFiles(hints, paginated ? listSpec([]) : updateSpec([THING_ID]))[0].source
    expect(source).toContain('   * @example\n   * ```ts\n   * const result = await client.things.get(\n   *   "thing-1",\n   * )\n   * ```')
    expect(source).toContain('   * @example\n   * ```ts\n   * console.log(result)\n   * ```')
  })
})

describe('emit-sdk-resources empty request bodies', () => {
  it('sends an explicitly declared empty object without adding a public argument', () => {
    const source = emitUpdate([], [THING_ID], '', { emptyBody: true })
    expect(source).toContain('async update(thingId: string): Promise<Thing> {')
    expect(source).toContain('jsonBody: {},')
    expect(source).not.toContain('omitUndefined')
  })

  it('refuses conflicting empty and argument bodies', () => {
    expect(() => emitUpdate([], [THING_ID], '', {
      emptyBody: true,
      body: { arg: 'body', type: 'Thing' },
    })).toThrow(/emptyBody.*body/)
  })
})

describe('emit-sdk-resources @returns', () => {
  it('uses the spec 2xx description when it has one', () => {
    const source = emitUpdate([], [THING_ID], 'The updated thing')

    expect(source).toContain('@returns The updated thing.')
  })

  it('omits @returns on a plain method when the 2xx description is empty', () => {
    expect(emitUpdate([], [THING_ID])).not.toContain('@returns')
  })

  it('falls back to the page items on a paginated method', () => {
    const source = emitList([], [queryParam('pageSize', 'Items per page.')])

    expect(source).toContain('@returns A page of things.')
  })
})

describe('emit-sdk-resources parameter documentation', () => {
  it.each(['list', 'update'])('%s omits unexposed query parameters from all prose', (method) => {
    const parameters = [queryParam('source', 'Choose the source. Cannot combine with `hiddenFilter`.'), queryParam('hiddenFilter')]
    const description = 'Returns matching things. Optional `hiddenFilter` narrows results. Use `source` to select a surface.'
    const spec = method === 'list'
      ? listSpec(parameters, description)
      : updateSpec([THING_ID, ...parameters], '', description)
    const hints = method === 'list' ? listHints(['source']) : updateHints(['source'])
    const [{ source }] = emitResourceFiles(hints, spec)

    expect(source).not.toContain('hiddenFilter')
    expect(source).toContain('Returns matching things.')
    expect(source).toContain('Use `source` to select a surface.')
    expect(source).toContain('@param options.source - Choose the source.')
  })

  it('preserves ordinary page prose when the legacy page parameter is unexposed', () => {
    const spec = listSpec([
      queryParam('page'),
      queryParam('pageToken', 'Opaque token. Omit for the first page.'),
    ], 'Returns a page of things. The legacy `page` parameter selects a page by number.')
    const [{ source }] = emitResourceFiles(listHints([]), spec)
    expect(source).toContain('Returns a page of things.')
    expect(source).toContain('@param options.pageToken - Opaque token. Omit for the first page.')
    expect(source).not.toContain('legacy `page`')
  })

  it.each([
    'Items per page. Defaults to 10, clamped to 100.',
    'Items per page. Defaults to 100 when no pagination params are sent (legacy); otherwise 25.',
    '',
  ])('documents the SDK page size default instead of API prose: %s', (description) => {
    const source = emitList([], [queryParam('pageSize', description)])
    expect(source).toContain('@param options.pageSize - Items per page. Defaults to 25.')
    expect(source).not.toContain('Defaults to 10')
    expect(source).not.toContain('legacy')
  })

  it('uses a code reference for a request type that need not be exported in TypeDoc', () => {
    const source = emitUpdate([], [THING_ID], '', { body: { arg: 'request', type: 'Thing' } })
    expect(source).toContain('@param request - Request body; see `Thing`.')
    expect(source).not.toContain('{@link Thing}')
  })
})


describe('emit-sdk-resources shared operations and nested resources', () => {
  it('emits separate bases for each surface beside generated child resources', () => {
    const hints = listHints([])
    const exposure = hints.operations.ThingsController_list.exposures[0]
    hints.operations.ThingsController_list.exposures.push(
      { ...exposure, surface: 'consumption' },
      { ...exposure, resource: ['things', 'records'] },
    )
    const files = emitResourceFiles(hints, listSpec([]))
    expect(files.map((file: { path: string }) => file.path)).toEqual([
      'src/_generated/resources/consumption/things.ts',
      'src/_generated/resources/management/things.ts',
      'src/_generated/resources/management/things/records.ts',
    ])
    expect(files[0].source).toContain('class ThingsResourceBase')
    expect(files[1].source).toContain('class ThingsResourceBase')
    expect(files[2].source).toContain('class ThingsRecordsResourceBase')
  })
})


describe('emit-sdk-resources response envelopes', () => {
  function envelopeSpec(fieldSchema: Record<string, unknown> = { type: 'array', items: { type: 'object' } }) {
    const spec = updateSpec([THING_ID])
    return {
      ...spec,
      components: { schemas: { Envelope: { type: 'object', properties: { things: fieldSchema } } } },
      paths: {
        '/api/v1/things/{thingId}': {
          patch: {
            ...spec.paths['/api/v1/things/{thingId}'].patch,
            responses: { 200: { description: '', content: { 'application/json': { schema: { $ref: '#/components/schemas/Envelope' } } } } },
          },
        },
      },
    }
  }

  it('returns the named envelope array with its public item type', () => {
    const [{ source }] = emitResourceFiles(updateHints([], { unwrap: 'things' }), envelopeSpec())
    expect(source).toContain('Promise<Thing[]>')
    expect(source).toContain('return (data as { things: Thing[] }).things')
  })

  it.each(['missing', 'non-array'])('refuses an invalid envelope field: %s', (shape) => {
    const spec = envelopeSpec(shape === 'non-array' ? { type: 'string' } : undefined)
    expect(() => emitResourceFiles(updateHints([], { unwrap: shape === 'missing' ? 'missing' : 'things' }), spec))
      .toThrow(/unwrap.*array/)
  })

  it('keeps TypeScript signatures and dispatch unchanged by Python-only hints', () => {
    const source = emitUpdate([], [THING_ID], '', {
      pyAsync: false, pyOperation: 'replace',
      body: { arg: 'request', pyArg: 'replacement', type: 'Thing', tsPolicy: 'validate-original', pyDump: { byAlias: false, excludeNone: false } },
    })
    expect(source).toContain('request: Thing')
    expect(source).toContain("'ThingsController_update'")
    expect(source).toContain('jsonBody: request,')
    expect(source).not.toContain('replacement')
  })
})

describe('emit-sdk-resources validation order', () => {
  it('passes the original write body to request validation', () => {
    const source = emitUpdate([], [THING_ID], '', { body: { arg: 'request', type: 'Thing', tsPolicy: 'validate-original' } })
    expect(source).toContain('jsonBody: request,')
    expect(source).not.toContain('omitUndefined')
  })

  it.each([undefined, 'omit-then-validate'])('omits undefined before validation with policy %s', (tsPolicy) => {
    const source = emitUpdate([], [THING_ID], '', { body: { arg: 'request', type: 'Thing', tsPolicy } })
    expect(source).toContain('jsonBody: omitUndefined(request as Record<string, unknown>),')
    expect(source).toContain('invokeWithRetry, omitUndefined')
  })

  it('can preserve bound-id validation before positional path arguments', () => {
    const spec = updateSpec([THING_ID, { name: 'parentId', in: 'path' }])
    const source = emitResourceFiles(
      updateHints([], { bind: { parentId: 'scopeId' }, boundIdsFirst: true }),
      { ...spec, paths: { '/api/v1/parents/{parentId}/things/{thingId}': spec.paths['/api/v1/things/{thingId}'] } },
    )[0].source
    expect(source.indexOf("validateId(this.scopeId, 'scope_id')"))
      .toBeLessThan(source.indexOf("validateId(thingId, 'thing_id')"))
  })
})
