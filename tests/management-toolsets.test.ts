import { describe, expect, it, vi } from 'vitest'
import { UnprocessableError } from '../src/_exceptions.js'
import { ModusManagement, type PlatformToolsetEntry, type ToolsetInput } from '../src/management/index.js'

const CONNECTION = '11111111-1111-4111-8111-111111111111'
const OTHER_CONNECTION = '22222222-2222-4222-8222-222222222222'

const toolset: ToolsetInput = {
  slack: {
    byConnection: {
      [CONNECTION]: {
        actions: ['SendMessage'],
        rules: { allowedChannelIds: ['C123'], allowedChannelNames: { C123: 'support' } },
      },
      [OTHER_CONNECTION]: { actions: ['GetMessages'] },
    },
  } satisfies PlatformToolsetEntry,
  postgresql: { byConnection: { [CONNECTION]: { actions: ['query'] } } } satisfies PlatformToolsetEntry,
  memory: { enabled: true },
  web_search: ['search'],
  file_publish: { actions: ['publish'], rules: { nameMode: 'restricted', allowedNames: ['report'] } },
  Coding: [{ connectionUid: CONNECTION, repoOwner: 'example', repoName: 'app', branch: 'main' }],
  custom_mcps: ['example'],
  pipedream: ['example'],
}

describe.each(['create', 'update'] as const)('scope %s toolsets', (operation) => {
  it.each([toolset, { slack: { byConnection: { [CONNECTION]: { actions: [] } } } }, { slack: { byConnection: {} } }, {}])(
    'forwards grants without merging, binding or changing nonintegration formats: %j',
    async (input) => {
      const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 42 }), { status: 200 }))
      const mgmt = new ModusManagement({ apiKey: 'modus_test_key', maxRetries: 0, fetch })
      if (operation === 'create') await mgmt.scopes.create({ name: 'Tools', toolset: input })
      else await mgmt.scopes.update(42, { toolset: input })
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch.mock.calls[0]?.[1]?.method).toBe(operation === 'create' ? 'POST' : 'PATCH')
      expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)).toolset).toEqual(input)
    },
  )

  it.each([
    { slack: { actions: ['SendMessage'] } },
    { slack: ['SendMessage'] },
    { slack: { scope: 'personal', actions: ['SendMessage'] } },
    { slack: { byConnection: { [CONNECTION]: { actions: ['SendMessage:project'] } } } },
    { slack: { byConnection: { 'not-a-uuid': { actions: ['SendMessage'] } } } },
    { sql_runner: [`SELECT:${CONNECTION}:`] },
    { looker_bi: ['query'] },
    { langfuse_observability: ['traces'] },
  ])('surfaces the API rejection without repairing the supplied toolset: %j', async (input) => {
    const info = { platformKey: Object.keys(input)[0], path: 'toolset' }
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'VALIDATION', message: 'Invalid integration toolset', info, requestId: 'req-toolset' },
    }), { status: 422 }))
    const mgmt = new ModusManagement({ apiKey: 'modus_test_key', maxRetries: 2, fetch })
    const call = operation === 'create'
      ? mgmt.scopes.create({ name: 'Tools', toolset: input })
      : mgmt.scopes.update(42, { toolset: input })
    await expect(call).rejects.toBeInstanceOf(UnprocessableError)
    await expect(call).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION', info, requestId: 'req-toolset' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)).toolset).toEqual(input)
  })
})
