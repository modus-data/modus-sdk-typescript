import { randomUUID } from 'node:crypto'
import type { ModusConfig } from '../../_config.js'
import { ModusError } from '../../_exceptions.js'
import type { OperationId } from '../../_generated/operations.js'
import {
  formatOperationPath,
  getOperation,
  operationBaseUrl,
} from '../../_openapi-invoke.js'
import type { HttpClient } from '../../_http.js'
import { Page, normalizePageToken } from '../../_pagination.js'
import { asRecord, invokeWithRetry } from '../../_request.js'
import { parseSseStream } from '../../_streaming.js'
import { validateId, validatePageSize } from '../../_validation.js'
import type {
  AgentRun,
  AgentRunListItem,
  AgentRunCreateRequest,
  ApprovalScope,
  CreateAgentRunRequest,
  ModusRunCreateRequest,
  ResumeRunRequest,
  RunStatus,
  RunTimeframe,
  SkillRunCreateRequest,
} from '../../types/agent-runs.js'
import type { ActiveConversationRun, RunEvent } from '../../types/runs.js'

const RUNS_MAX_PAGE_SIZE = 100

function runsListParams(
  pageSize: number,
  pageToken: string | undefined,
  status?: RunStatus,
  timeframe?: RunTimeframe,
  approvalScope?: ApprovalScope,
  search?: string,
): Record<string, string | number | boolean | undefined | null> {
  const params: Record<string, string | number | boolean | undefined | null> = { pageSize }
  const token = normalizePageToken(pageToken)
  if (token !== undefined) params.pageToken = token
  if (status !== undefined) params.status = status
  if (timeframe !== undefined) params.timeframe = timeframe
  if (approvalScope !== undefined) params.approvalScope = approvalScope
  if (search !== undefined) params.search = search
  return params
}

function activeRunsParams(
  pageSize: number,
  pageToken: string | undefined,
): Record<string, string | number> {
  const params: Record<string, string | number> = { pageSize }
  const token = normalizePageToken(pageToken)
  if (token !== undefined) params.pageToken = token
  return params
}

function parseRun(raw: unknown): AgentRun {
  return raw as AgentRun
}

function parseActiveRunsArray(raw: unknown): ActiveConversationRun[] {
  const data = asRecord(raw)
  const runs = data.runs
  if (!Array.isArray(runs)) {
    throw new ModusError(
      `Unexpected active runs response shape: runs must be a list, got ${typeof runs}.`,
    )
  }
  return runs as ActiveConversationRun[]
}

function parseActiveRunsPage(
  raw: unknown,
  fetchPage: (token: string) => Promise<Page<ActiveConversationRun>>,
): Page<ActiveConversationRun> {
  const data = asRecord(raw)
  const runs = data.runs
  if (!Array.isArray(runs)) {
    throw new ModusError(
      `Unexpected active runs response shape: runs must be a list, got ${typeof runs}.`,
    )
  }
  return new Page(
    runs as ActiveConversationRun[],
    normalizePageToken(
      typeof data.nextPageToken === 'string' ? data.nextPageToken : undefined,
    ),
    fetchPage,
  )
}

function randomRunId(): string {
  return randomUUID()
}

export interface AgentRunStream extends AsyncIterable<RunEvent> {
  readonly runId: string
  readonly events: AsyncIterable<RunEvent>
}

export function makeAgentRunStream(runId: string, events: AsyncIterable<RunEvent>): AgentRunStream {
  return {
    runId,
    events,
    [Symbol.asyncIterator]() {
      return events[Symbol.asyncIterator]()
    },
  }
}

export class WorkflowRunsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  list(
    workflowId: number | string,
    options: {
      pageSize?: number
      pageToken?: string
      status?: RunStatus
      timeframe?: RunTimeframe
      approvalScope?: ApprovalScope
      search?: string
    } = {},
  ): Promise<Page<AgentRunListItem>> {
    validateId(workflowId, 'workflow_id')
    const pageSize = options.pageSize ?? 25
    validatePageSize(pageSize, RUNS_MAX_PAGE_SIZE)
    return this.listPage(workflowId, pageSize, options.pageToken, options)
  }

  private async listPage(
    workflowId: number | string,
    pageSize: number,
    pageToken: string | undefined,
    filters: {
      status?: RunStatus
      timeframe?: RunTimeframe
      approvalScope?: ApprovalScope
      search?: string
    },
  ): Promise<Page<AgentRunListItem>> {
    const data = asRecord(
      await invokeWithRetry(this.config, this.http, 'WorkflowRunsController_list', {
        pathParams: { id: workflowId },
        query: runsListParams(
          pageSize,
          pageToken,
          filters.status,
          filters.timeframe,
          filters.approvalScope,
          filters.search,
        ),
      }),
    )
    const runs = data.runs
    if (!Array.isArray(runs)) {
      throw new ModusError(
        `Unexpected list response shape: runs must be a list, got ${typeof runs}.`,
      )
    }
    return new Page(
      runs as AgentRunListItem[],
      normalizePageToken(
        typeof data.nextPageToken === 'string' ? data.nextPageToken : undefined,
      ),
      (token: string) => this.listPage(workflowId, pageSize, token, filters),
    )
  }

  async get(
    workflowId: number | string,
    runId: string,
    options: { temporalRunId?: string } = {},
  ): Promise<AgentRun> {
    validateId(workflowId, 'workflow_id')
    if (!runId.trim()) throw new Error('run_id must be a non-empty string')
    const query =
      options.temporalRunId !== undefined
        ? { temporalRunId: options.temporalRunId }
        : undefined
    const data = await invokeWithRetry(this.config, this.http, 'WorkflowRunsController_get', {
      pathParams: { id: workflowId, runId },
      query,
    })
    return parseRun(data)
  }

  create(
    workflowId: number | string,
    body: CreateAgentRunRequest,
    options: { idempotencyKey?: string } = {},
  ): AgentRunStream {
    validateId(workflowId, 'workflow_id')
    return this.createRun('WorkflowRunsController_create', body, { id: workflowId }, options)
  }

  createScope(
    scopeId: number | string,
    body: SkillRunCreateRequest,
    options: { idempotencyKey?: string } = {},
  ): AgentRunStream {
    validateId(scopeId, 'scope_id')
    return this.createRun('ScopeRunsController_create', body, { id: scopeId }, options)
  }

  createModus(
    body: ModusRunCreateRequest,
    options: { idempotencyKey?: string } = {},
  ): AgentRunStream {
    return this.createRun('ModusRunsController_create', body, {}, options)
  }

  resume(
    runId: string,
    body: ResumeRunRequest,
    options: { idempotencyKey?: string } = {},
  ): AgentRunStream {
    validateId(runId, 'run_id')
    return this.createRun('ResumeRunsController_create', body, { runId }, options)
  }

  async cancel(runId: string): Promise<void> {
    validateId(runId, 'run_id')
    await invokeWithRetry(this.config, this.http, 'RunLifecycleController_cancel', {
      pathParams: { runId },
      jsonBody: {},
    })
  }

  async events(runId: string): Promise<unknown> {
    validateId(runId, 'run_id')
    return invokeWithRetry(this.config, this.http, 'RunLifecycleController_events', {
      pathParams: { runId },
    })
  }

  async interrupt(runId: string): Promise<void> {
    validateId(runId, 'run_id')
    await invokeWithRetry(this.config, this.http, 'RunLifecycleController_interrupt', {
      pathParams: { runId },
      jsonBody: {},
    })
  }

  async editQueued(runId: string): Promise<void> {
    validateId(runId, 'run_id')
    await invokeWithRetry(this.config, this.http, 'RunLifecycleController_editQueued', {
      pathParams: { runId },
      jsonBody: {},
    })
  }

  active(options: {
    pageSize?: number
    pageToken?: string
  } = {}): Promise<Page<ActiveConversationRun>> {
    const pageSize = options.pageSize ?? 50
    validatePageSize(pageSize, RUNS_MAX_PAGE_SIZE)
    return this.activePage(pageSize, options.pageToken)
  }

  private async activePage(
    pageSize: number,
    pageToken: string | undefined,
  ): Promise<Page<ActiveConversationRun>> {
    return parseActiveRunsPage(
      await invokeWithRetry(this.config, this.http, 'RunLifecycleController_active', {
        query: activeRunsParams(pageSize, pageToken),
      }),
      (token: string) => this.activePage(pageSize, token),
    )
  }

  async activeBySession(sessionIds: readonly string[]): Promise<ActiveConversationRun[]> {
    const uniqueSessionIds = [...new Set(sessionIds.map((id) => id.trim()).filter(Boolean))]
    if (uniqueSessionIds.length > 100) {
      throw new Error('sessionIds must contain at most 100 ids')
    }
    return parseActiveRunsArray(
      await invokeWithRetry(this.config, this.http, 'RunLifecycleController_activeBySession', {
        jsonBody: { sessionIds: uniqueSessionIds },
      }),
    )
  }

  stream(runId: string, options: { lastEventId?: string } = {}): AgentRunStream {
    validateId(runId, 'run_id')
    const op = getOperation('RunLifecycleController_stream')
    const path = formatOperationPath('RunLifecycleController_stream', { runId })
    const lines = this.http.streamGet(path, undefined, {
      baseUrl: operationBaseUrl(this.http, op),
      headers: options.lastEventId ? { 'Last-Event-ID': options.lastEventId } : undefined,
    })
    return makeAgentRunStream(runId, this.parseEvents(lines))
  }

  private createRun(
    operationId: OperationId,
    body: AgentRunCreateRequest | SkillRunCreateRequest | ModusRunCreateRequest | ResumeRunRequest,
    pathParams: Record<string, unknown>,
    options: { idempotencyKey?: string },
  ): AgentRunStream {
    const runId = options.idempotencyKey?.trim() || body.runId?.trim() || randomRunId()
    const sessionId =
      typeof (body as { sessionId?: unknown }).sessionId === 'string' &&
      (body as { sessionId: string }).sessionId.trim()
        ? (body as { sessionId: string }).sessionId.trim()
        : randomRunId()
    const op = getOperation(operationId)
    const path = formatOperationPath(operationId, pathParams)
    const lines = this.http.streamPost(path, {
      ...body,
      sessionId,
      streamProtocolVersion: 2,
    }, {
      baseUrl: operationBaseUrl(this.http, op),
      headers: { 'Idempotency-Key': runId },
    })
    return makeAgentRunStream(runId, this.parseEvents(lines))
  }

  private async *parseEvents(lines: AsyncIterable<string>): AsyncGenerator<RunEvent> {
    yield* parseSseStream(lines)
  }
}
