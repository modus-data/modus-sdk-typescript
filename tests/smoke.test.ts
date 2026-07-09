import { describe, expect, it } from 'vitest'
import { Modus } from '../src/index.js'
import { ModusManagement } from '../src/management/index.js'
import { OPERATIONS } from '../src/_generated/operations.js'

const TEST_KEY = 'modus_test_key_smoke'

describe('@modus/sdk scaffold', () => {
  it('exports Modus and ModusManagement', () => {
    const client = new Modus({ apiKey: TEST_KEY })
    expect(client).toBeInstanceOf(Modus)
    expect(client.modus).toBeDefined()
    expect(typeof client.modus.chat).toBe('function')
    expect(client.modus.conversations).toBeDefined()
    expect(client.context.items).toBeDefined()
    expect(client.connections).toBeDefined()
    expect(client.suggestions).toBeDefined()
    // Canonical scopes/workflows surfaces on the consumption client.
    expect(client.scopes).toBeDefined()
    expect(typeof client.scopes.chat).toBe('function')
    expect(typeof client.scopes.chatStream).toBe('function')
    expect(client.workflows).toBeDefined()
    expect(client.workflows.runs).toBeDefined()
    expect(client.workflows.workflowActions).toBeDefined()
    const mgmt = new ModusManagement({ apiKey: TEST_KEY })
    expect(mgmt).toBeInstanceOf(ModusManagement)
    // Canonical scopes/workflows surfaces on the management client.
    expect(mgmt.scopes).toBeDefined()
    expect(typeof mgmt.scopes.create).toBe('function')
    expect(mgmt.workflows).toBeDefined()
    expect(typeof mgmt.workflows.create).toBe('function')
  })

  it('generates operation registry for all public ops', () => {
    expect(Object.keys(OPERATIONS).length).toBe(70)
    expect(OPERATIONS.SuggestionsController_listApproved?.method).toBe('GET')
    // Canonical scopes/workflows operations resolve through the registry.
    expect(OPERATIONS.ScopesController_list?.method).toBe('GET')
    expect(OPERATIONS.ScopeRunsController_create).toMatchObject({
      method: 'POST',
      service: 'agent-service',
    })
    expect(OPERATIONS.WorkflowRunsController_create).toMatchObject({
      method: 'POST',
      service: 'agent-service',
    })
  })
})
