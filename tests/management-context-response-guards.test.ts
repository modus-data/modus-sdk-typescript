import { describe, expect, it, vi } from 'vitest'
import { ModusManagement } from '../src/management/index.js'

const operations: [string, (client: ModusManagement) => Promise<unknown>][] = [
  ['files.get', (client) => client.context.files.get('upload-1')],
  ['files.list', (client) => client.context.files.list()],
  ['elements.list', (client) => client.context.dashboards.elements('dash-1').list()],
  ['elements.get', (client) => client.context.dashboards.elements('dash-1').get('element-1')],
  ['listVersions', (client) => client.context.dashboards.listVersions('dash-1')],
  ['listDraftSnapshots', (client) => client.context.dashboards.listDraftSnapshots('dash-1')],
  ['getVersion', (client) => client.context.dashboards.getVersion('dash-1', 'version-1')],
  ['restoreVersion', (client) => client.context.dashboards.restoreVersion('dash-1', 'version-1')],
  ['cancelOwnershipTransfer', (client) => client.context.dashboards.cancelOwnershipTransfer('dash-1')],
  ['acceptOwnershipTransfer', (client) => client.context.dashboards.acceptOwnershipTransfer('dash-1')],
]

describe.each(operations)('%s response validation', (_name, invoke) => {
  it.each([[null], [[]], ['invalid'], [42], [false]])('rejects a non-object success response: %j', async (body) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    const client = new ModusManagement({ apiKey: 'modus_test_key', maxRetries: 0, fetch })

    await expect(invoke(client)).rejects.toThrow(`Expected object response, got ${typeof body}`)
  })
})
