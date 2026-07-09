/**
 * Registry of TypeScript SDK AIP-158 list operations for contract tests.
 */
import type { Modus } from '../../src/index.js'
import type { ModusManagement } from '../../src/management/index.js'

export type ClientKind = 'modus' | 'management'
export type SdkClient = Modus | ModusManagement

export const REJECTED_LIST_RESPONSE_BODY = {
  items: [],
  nextCursor: null,
} as const

export const FORBIDDEN_RESPONSE_KEYS = new Set(['items', 'data', 'results'])
export const FORBIDDEN_QUERY_PARAMS = new Set(['limit', 'cursor'])

const SAMPLE_SKILL = { id: 1, name: 'Analyst' }
const SAMPLE_AGENT = { id: 2, name: 'Scheduler' }
const SAMPLE_CONTEXT_ITEM = { uid: '7a3f9d2c-1111-4000-a000-000000000abc' }
const SAMPLE_RUN = { runId: 'run-1', status: 'completed' }
const SAMPLE_EVAL_RUN = { id: 'run-1', status: 'completed', skillId: 42, trigger: 'manual' }
const SAMPLE_CONNECTION = {
  id: '7a3f9d2c-1111-4000-a000-000000000abc',
  name: 'Production Warehouse',
  type: 'postgresql',
}
const SAMPLE_SUGGESTION = {
  id: 'predefined:q1',
  skill_id: 42,
  label: 'Revenue',
  prompt: 'Show me revenue',
}
const SAMPLE_VALUE_ENTRY = { value: 123 }
const SAMPLE_MEMORY = { id: 'mem_01', memory: 'User prefers bullet points.' }
const SAMPLE_CONVERSATION_LIST_ITEM = {
  threadId: 'thread-0',
  skillId: 42,
  firstMessage: 'Hello',
  title: null,
  messageCount: 5,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  userIds: ['user-abc'],
}

export interface ListOperationSpec {
  operationId: string
  mockUrlSuffix: string
  itemsKey: string
  wrongItemsKey: string
  sampleItem: Record<string, unknown>
  clientKind: ClientKind
  expectedPageSize?: number
  invoke: (client: SdkClient) => Promise<unknown>
  extraSuccessFields?: Record<string, unknown>
}

export function successBody(spec: ListOperationSpec): Record<string, unknown> {
  return {
    [spec.itemsKey]: [spec.sampleItem],
    nextPageToken: null,
    ...spec.extraSuccessFields,
  }
}

export function wrongKeyBody(spec: ListOperationSpec): Record<string, unknown> {
  return {
    [spec.wrongItemsKey]: [],
    nextPageToken: null,
    ...spec.extraSuccessFields,
  }
}

export const SDK_AIP_LIST_OPERATIONS: ListOperationSpec[] = [
  {
    operationId: 'ConnectionsController_list',
    mockUrlSuffix: '/api/v1/connections',
    itemsKey: 'connections',
    wrongItemsKey: 'scopes',
    sampleItem: SAMPLE_CONNECTION,
    clientKind: 'modus',
    invoke: (c) => c.connections.list({ pageSize: 25, pageToken: 'tok_abc' }),
  },
  {
    operationId: 'SuggestionsController_listApproved',
    mockUrlSuffix: '/api/v1/suggestions/questions',
    itemsKey: 'suggestions',
    wrongItemsKey: 'skills',
    sampleItem: SAMPLE_SUGGESTION,
    clientKind: 'modus',
    expectedPageSize: 5,
    invoke: (c) => c.suggestions.list({ pageSize: 5, pageToken: 'tok_abc', skillIds: [7, 42] }),
  },
  {
    operationId: 'ContextItemsController_list',
    mockUrlSuffix: '/api/v1/context/items',
    itemsKey: 'contextItems',
    wrongItemsKey: 'scopes',
    sampleItem: SAMPLE_CONTEXT_ITEM,
    clientKind: 'modus',
    invoke: (c) => c.context.items.list({ pageSize: 25, pageToken: 'tok_abc', contextType: 'note' }),
  },
  {
    operationId: 'ContextItemsController_listValues',
    mockUrlSuffix: '/api/v1/context/items/7a3f9d2c-1111-4000-a000-000000000abc/values',
    itemsKey: 'values',
    wrongItemsKey: 'scopes',
    sampleItem: SAMPLE_VALUE_ENTRY,
    clientKind: 'modus',
    invoke: (c) =>
      c.context.items.listValues(
        '7a3f9d2c-1111-4000-a000-000000000abc',
        'metric',
        'amount',
        { pageSize: 25, pageToken: 'tok_abc' },
      ),
  },
  {
    operationId: 'ModusConversationsController_list',
    mockUrlSuffix: '/api/v1/modus/conversations',
    itemsKey: 'conversations',
    wrongItemsKey: 'scopes',
    sampleItem: SAMPLE_CONVERSATION_LIST_ITEM,
    clientKind: 'modus',
    invoke: (c) => c.modus.conversations.list({ pageSize: 25, pageToken: 'tok_abc', kind: 'modus' }),
  },
  {
    operationId: 'ContextItemsController_list',
    mockUrlSuffix: '/api/v1/context/items',
    itemsKey: 'contextItems',
    wrongItemsKey: 'scopes',
    sampleItem: SAMPLE_CONTEXT_ITEM,
    clientKind: 'management',
    invoke: (c) =>
      (c as ModusManagement).context.items.list({
        pageSize: 25,
        pageToken: 'tok_abc',
        contextType: 'note',
      }),
  },
  // --- Scopes / Workflows (canonical public surface) ---
  {
    operationId: 'ScopesController_list',
    mockUrlSuffix: '/api/v1/scopes',
    itemsKey: 'skills',
    wrongItemsKey: 'workflows',
    sampleItem: SAMPLE_SKILL,
    clientKind: 'modus',
    invoke: (c) => c.scopes.list({ pageSize: 25, pageToken: 'tok_abc' }),
  },
  {
    operationId: 'ScopesController_list',
    mockUrlSuffix: '/api/v1/scopes',
    itemsKey: 'skills',
    wrongItemsKey: 'workflows',
    sampleItem: SAMPLE_SKILL,
    clientKind: 'management',
    invoke: (c) => (c as ModusManagement).scopes.list({ pageSize: 25, pageToken: 'tok_abc' }),
  },
  {
    operationId: 'WorkflowsController_list',
    mockUrlSuffix: '/api/v1/workflows',
    itemsKey: 'agents',
    wrongItemsKey: 'scopes',
    sampleItem: SAMPLE_AGENT,
    clientKind: 'modus',
    invoke: (c) => c.workflows.list({ pageSize: 25, pageToken: 'tok_abc' }),
  },
  {
    operationId: 'WorkflowsController_list',
    mockUrlSuffix: '/api/v1/workflows',
    itemsKey: 'agents',
    wrongItemsKey: 'scopes',
    sampleItem: SAMPLE_AGENT,
    clientKind: 'management',
    invoke: (c) => (c as ModusManagement).workflows.list({ pageSize: 25, pageToken: 'tok_abc' }),
  },
  {
    operationId: 'WorkflowRunsController_list',
    mockUrlSuffix: '/api/v1/workflows/7/runs',
    itemsKey: 'runs',
    wrongItemsKey: 'scopes',
    sampleItem: SAMPLE_RUN,
    clientKind: 'modus',
    invoke: (c) => c.workflows.runs.list(7, { pageSize: 25, pageToken: 'tok_abc' }),
    extraSuccessFields: { counts: {} },
  },
  {
    operationId: 'ScopeConversationsController_list',
    mockUrlSuffix: '/api/v1/scopes/42/conversations',
    itemsKey: 'conversations',
    wrongItemsKey: 'scopes',
    sampleItem: SAMPLE_CONVERSATION_LIST_ITEM,
    clientKind: 'modus',
    invoke: (c) => c.scopes.conversations(42).list({ pageSize: 25, pageToken: 'tok_abc' }),
  },
  {
    operationId: 'ScopeMemoriesController_list',
    mockUrlSuffix: '/api/v1/scopes/42/memories',
    itemsKey: 'memories',
    wrongItemsKey: 'scopes',
    sampleItem: SAMPLE_MEMORY,
    clientKind: 'management',
    invoke: (c) =>
      (c as ModusManagement).scopes.memories(42).list({ pageSize: 25, pageToken: 'tok_abc' }),
  },
  {
    operationId: 'EvaluationsController_listRuns',
    mockUrlSuffix: '/api/v1/scopes/42/evaluations/runs',
    itemsKey: 'runs',
    wrongItemsKey: 'scopes',
    sampleItem: SAMPLE_EVAL_RUN,
    clientKind: 'management',
    invoke: (c) =>
      (c as ModusManagement).scopes.evaluations(42).listRuns({ pageSize: 25, pageToken: 'tok_abc' }),
  },
]
