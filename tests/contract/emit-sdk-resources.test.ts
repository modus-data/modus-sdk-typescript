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
}

const THING_ID: SpecParameter = { name: 'thingId', in: 'path', description: 'Thing id.' }

function updateSpec(parameters: SpecParameter[], responseDescription = '') {
  return {
    paths: {
      '/api/v1/things/{thingId}': {
        patch: {
          operationId: 'ThingsController_update',
          summary: 'Update a thing',
          description: 'Updates one thing.',
          'x-modus-service': 'modus-api',
          parameters,
          responses: { 200: { description: responseDescription } },
        },
      },
    },
  }
}

function updateHints(query: string[]) {
  return {
    types: { Thing: { ts: 'src/types/things.ts', py: 'modus.types.things' } },
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
          },
        ],
        cli: 'things update',
      },
    },
  }
}

function emitUpdate(
  query: string[],
  parameters: SpecParameter[],
  responseDescription = '',
): string {
  const files = emitResourceFiles(updateHints(query), updateSpec(parameters, responseDescription))
  expect(files).toHaveLength(1)
  expect(files[0].path).toBe('src/_generated/resources/management/things.ts')
  return files[0].source
}

describe('emit-sdk-resources query templates', () => {
  it('forwards an ordinary optional query field under its wire name', () => {
    const source = emitUpdate(
      ['view'],
      [THING_ID, { name: 'view', in: 'query', description: 'Which revision to read.' }],
    )

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
      [THING_ID, { name: 'view', in: 'query' }, { name: 'search', in: 'query' }],
    )

    expect(source).toContain('options: { view?: string; search?: string } = {}')
    expect(source).toContain('query: { view: options.view, search: options.search },')
  })

  it('mixes updateMask with ordinary query fields', () => {
    const source = emitUpdate(
      ['updateMask', 'view'],
      [
        THING_ID,
        { name: 'updateMask', in: 'query', description: 'Fields to update.' },
        { name: 'view', in: 'query' },
      ],
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
      [THING_ID, { name: 'updateMask', in: 'query', description: 'Fields to update.' }],
    )

    expect(source).toContain('query: updateMaskQuery(options.updateMask),')
    expect(source).not.toContain('...updateMaskQuery')
  })

  it('emits no query object and no options argument when no query field is exposed', () => {
    const source = emitUpdate([], [THING_ID])

    expect(source).toContain('async update(thingId: string): Promise<Thing>')
    expect(source).not.toContain('query:')
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
    const listSpec = {
      paths: {
        '/api/v1/things': {
          get: {
            operationId: 'ThingsController_list',
            summary: 'List things',
            'x-modus-service': 'modus-api',
            parameters: [{ name: 'pageSize', in: 'query', description: 'Items per page.' }],
            responses: { 200: { description: '' } },
          },
        },
      },
    }
    const listHints = {
      types: { Thing: { ts: 'src/types/things.ts', py: 'modus.types.things' } },
      operations: {
        ThingsController_list: {
          mode: 'generated',
          exposures: [
            { surface: 'management', resource: ['things'], method: 'list', returns: 'Thing' },
          ],
          pagination: { items: 'things' },
          cli: 'things list',
        },
      },
    }

    expect(emitResourceFiles(listHints, listSpec)[0].source).toContain('@returns A page of things.')
  })
})
