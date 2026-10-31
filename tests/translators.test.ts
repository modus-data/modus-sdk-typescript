import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { ModusManagement } from '../src/management/index.js'

const generated = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/_generated/v1.ts'),
  'utf8',
)

const CORE = { chat: false, getContext: true, teachModus: false }
const EXPOSURE = { version: 1, mode: 'discovery' as const, allowedIntegrationKeys: [] as string[] }

function generatedBlock(name: string, length: number): string {
  const start = generated.indexOf(`${name}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  return generated.slice(start, start + length)
}

describe('MCP config response translators', () => {
  it('generated response types use booleans and a subset or discovery mode', () => {
    const core = generatedBlock('McpCoreToolsConfigDto', 700)
    expect(core).toContain('chat: boolean')
    expect(core).toContain('getContext: boolean')
    expect(core).toContain('teachModus: boolean')
    expect(generatedBlock('McpToolExposureMode', 200)).toContain('"subset" | "discovery"')
    expect(generatedBlock('McpToolExposureVersion', 120)).toContain('1;')
    const response = generatedBlock('SkillMcpInterfaceConfigResponseDto', 400)
    expect(response).toContain('coreTools?: components["schemas"]["McpCoreToolsConfigDto"]')
    expect(response).toContain('mcpToolExposure?: components["schemas"]["McpToolExposureConfigDto"]')
    expect(response).not.toContain('| null')
  })

  it('re-sends the effective config a scope GET returns', async () => {
    const scopeResponse = {
      id: 10,
      variation: {
        interfaces: [
          { id: 'iface-1', type: 'mcp', name: 'MCP Server', config: { coreTools: CORE, mcpToolExposure: EXPOSURE } },
        ],
      },
    }
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify(init?.method === 'PATCH' ? { config: scopeResponse.variation.interfaces[0]?.config } : scopeResponse), {
          status: 200,
        }),
      ),
    )
    const mgmt = new ModusManagement({
      apiKey: 'modus_test_key_translators',
      baseUrl: 'https://api.getmodus.com',
      maxRetries: 0,
      fetch,
    })
    const scope = await mgmt.scopes.get(10)
    const config = scope.variation?.interfaces[0]?.config
    expect(config?.coreTools).toEqual(CORE)
    expect(config?.mcpToolExposure).toEqual(EXPOSURE)
    if (!config) return
    await mgmt.scopes.patchMcpConfig(10, { mcpConfig: config })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1]?.[1]?.method).toBe('PATCH')
    const body = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body)) as {
      config: { coreTools: typeof CORE; mcpToolExposure: typeof EXPOSURE }
    }
    expect(body.config.coreTools).toEqual(CORE)
    expect(body.config.mcpToolExposure).toEqual(EXPOSURE)
  })
})
