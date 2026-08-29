import { randomUUID } from 'node:crypto'
import type { ModusConfig } from '../../_config.js'
import { resolveAgentRunSessionId } from '../../_agent_run_request.js'
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

function sessionIdFromBody(body: { sessionId?: string }): string {
  return resolveAgentRunSessionId(body.sessionId)
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

/**
 * Start, inspect, and control workflow runs.
 *
 * Typical path: `create` (or `createScope` / `createModus`) → stream events →
 * `list` / `get` history → `cancel` or `resume` when needed.
 *
 * @example
 * ```ts
 * const stream = client.workflows.runs.create(workflowId, {
 *   message: "Summarize yesterday's sales",
 *   config: { model: 'claude-sonnet-5' },
 * })
 * for await (const event of stream) {
 *   if (event.type === 'token') process.stdout.write(event.content)
 * }
 * ```
 */
export class WorkflowRunsResource {
  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  /**
   * List runs for a workflow.
   *
   * @param workflowId - Workflow id or slug.
   * @param options.pageSize - Maximum items per page (default 25, max 100).
   * @param options.pageToken - Opaque token from a previous page.
   * @param options.status - Filter by run status.
   * @param options.timeframe - Filter by recency (`last_hour`, `last_day`, or `last_week`).
   * @param options.approvalScope - Filter approval-related runs (`mine` or `all`).
   * @param options.search - Free-text search filter.
   * @returns A page of run summaries — use `.autoPagingIter()` for all pages.
   *
   * @example
   * ```ts
   * for await (const run of (
   *   await client.workflows.runs.list(workflowId, { status: 'completed' })
   * ).autoPagingIter()) {
   *   console.log(run.workflowId, run.status, run.startedAt)
   * }
   * ```
   */
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

  /**
   * Retrieve a workflow run by id.
   *
   * @param workflowId - Workflow id or slug the run belongs to.
   * @param runId - Run id (the list row's `workflowId` field, not the composite `id`).
   * @param options.temporalRunId - Optional internal execution id when disambiguating retries.
   * @returns Run details including status and output.
   * @throws {NotFoundError} When the run does not exist.
   *
   * @example
   * ```ts
   * const run = await client.workflows.runs.get(workflowId, runId)
   * console.log(run.status)
   * ```
   */
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

  /**
   * Start a workflow run and stream run events.
   *
   * @param workflowId - Workflow id or slug to run.
   * @param body - Run body (`message`, optional `sessionId`, optional `version` as `published` or `draft`).
   * @param options.idempotencyKey - Client-supplied idempotency key; defaults to `body.runId` or a new uuid.
   * @returns A stream of run events (tokens, completion, errors, and related signals).
   *
   * @example
   * ```ts
   * const stream = client.workflows.runs.create(workflowId, {
   *   message: "Summarize yesterday's sales",
   *   config: { model: 'claude-sonnet-5' },
   * })
   * for await (const event of stream) {
   *   if (event.type === 'token') process.stdout.write(event.content)
   *   if (event.type === 'done') break
   * }
   * ```
   */
  create(
    workflowId: number | string,
    body: CreateAgentRunRequest,
    options: { idempotencyKey?: string } = {},
  ): AgentRunStream {
    validateId(workflowId, 'workflow_id')
    return this.createRun('WorkflowRunsController_create', body, { id: workflowId }, options)
  }

  /**
   * Start a scope run and stream run events.
   *
   * Same event stream shape as {@link create}, but targets a published scope.
   *
   * @param scopeId - Scope id to run.
   * @param body - Run body (`message`, optional `sessionId`, optional `version` as `published` or `draft`).
   * @param options.idempotencyKey - Client-supplied idempotency key; defaults to `body.runId` or a new uuid.
   * @returns A stream of run events.
   *
   * @example
   * ```ts
   * const stream = client.workflows.runs.createScope(scopeId, {
   *   message: 'What is our ARR trend?',
   *   config: { model: 'claude-sonnet-5' },
   * })
   * for await (const event of stream) {
   *   if (event.type === 'token') process.stdout.write(event.content)
   * }
   * ```
   */
  createScope(
    scopeId: number | string,
    body: SkillRunCreateRequest,
    options: { idempotencyKey?: string } = {},
  ): AgentRunStream {
    validateId(scopeId, 'scope_id')
    return this.createRun('ScopeRunsController_create', body, { id: scopeId }, options)
  }

  /**
   * Start a Modus org-assistant run and stream run events.
   *
   * @param body - Run body (`message`, optional `sessionId`, optional `subordinateSkillIds` to narrow context).
   * @param options.idempotencyKey - Client-supplied idempotency key; defaults to `body.runId` or a new uuid.
   * @returns A stream of run events.
   *
   * @example
   * ```ts
   * const stream = client.workflows.runs.createModus({
   *   message: 'Summarize ARR in three bullets.',
   *   config: { model: 'claude-sonnet-5' },
   * })
   * for await (const event of stream) {
   *   if (event.type === 'token') process.stdout.write(event.content)
   * }
   * ```
   */
  createModus(
    body: ModusRunCreateRequest,
    options: { idempotencyKey?: string } = {},
  ): AgentRunStream {
    return this.createRun('ModusRunsController_create', body, {}, options)
  }

  /**
   * Resume an interrupted run and stream run events.
   *
   * @param runId - Run id to resume.
   * @param body - Resume body (`message`, `sessionId`, and `decision`: `approve` / `deny` / `connected` / `cancelled`).
   * @param options.idempotencyKey - Client-supplied idempotency key; defaults to `body.runId` or a new uuid.
   * @returns A stream of run events.
   *
   * @example
   * ```ts
   * const stream = client.workflows.runs.resume(runId, {
   *   decision: 'approve',
   *   message: 'Looks good — continue.',
   *   sessionId,
   * })
   * for await (const event of stream) {
   *   if (event.type === 'token') process.stdout.write(event.content)
   * }
   * ```
   */
  resume(
    runId: string,
    body: ResumeRunRequest,
    options: { idempotencyKey?: string } = {},
  ): AgentRunStream {
    validateId(runId, 'run_id')
    return this.createRun('ResumeRunsController_create', body, { runId }, options)
  }

  /**
   * Cancel a run that is still in progress.
   *
   * @param runId - Run id to cancel.
   *
   * @example
   * ```ts
   * await client.workflows.runs.cancel(runId)
   * ```
   */
  async cancel(runId: string): Promise<void> {
    validateId(runId, 'run_id')
    await invokeWithRetry(this.config, this.http, 'RunLifecycleController_cancel', {
      pathParams: { runId },
      jsonBody: {},
    })
  }

  /**
   * Fetch stored run events for a run.
   *
   * @param runId - Run id.
   * @returns Run event history for replay or inspection.
   */
  async events(runId: string): Promise<unknown> {
    validateId(runId, 'run_id')
    return invokeWithRetry(this.config, this.http, 'RunLifecycleController_events', {
      pathParams: { runId },
    })
  }

  /**
   * Request a graceful stop for a running execution.
   *
   * @param runId - Run id to interrupt.
   */
  async interrupt(runId: string): Promise<void> {
    validateId(runId, 'run_id')
    await invokeWithRetry(this.config, this.http, 'RunLifecycleController_interrupt', {
      pathParams: { runId },
      jsonBody: {},
    })
  }

  /**
   * Move a queued run back into an editable state before it starts.
   *
   * @param runId - Queued run id.
   */
  async editQueued(runId: string): Promise<void> {
    validateId(runId, 'run_id')
    await invokeWithRetry(this.config, this.http, 'RunLifecycleController_editQueued', {
      pathParams: { runId },
      jsonBody: {},
    })
  }

  /**
   * List active conversation runs across the organization.
   *
   * @param options.pageSize - Maximum items per page (default 50, max 100).
   * @param options.pageToken - Opaque token from a previous page.
   * @returns A page of active runs with session and status metadata.
   */
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

  /**
   * Look up active runs for specific conversation sessions.
   *
   * @param sessionIds - Up to 100 session ids.
   * @returns Active runs matching any of the given sessions.
   * @throws {Error} When more than 100 session ids are provided.
   */
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

  /**
   * Reconnect to an in-progress run and stream run events.
   *
   * @param runId - Run id to follow.
   * @param options.lastEventId - Resume after this event id when catching up.
   * @returns A stream of run events from the current execution point.
   *
   * @example
   * ```ts
   * const stream = client.workflows.runs.stream(runId, { lastEventId: checkpoint })
   * for await (const event of stream) {
   *   if (event.type === 'token') process.stdout.write(event.content)
   * }
   * ```
   */
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
    const sessionId = sessionIdFromBody(body as { sessionId?: string })
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
