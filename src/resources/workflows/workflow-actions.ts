import { randomUUID } from 'node:crypto'
import type { ModusConfig } from '../../_config.js'
import {
  formatOperationPath,
  getOperation,
  operationBaseUrl,
} from '../../_openapi-invoke.js'
import type { HttpClient } from '../../_http.js'
import { invokeWithRetry } from '../../_request.js'
import { parseSseStream } from '../../_streaming.js'
import { validateId } from '../../_validation.js'
import type { WorkflowActionRequest } from '../../types/agent-runs.js'
import type { RunEvent } from '../../types/runs.js'
import { makeAgentRunStream, type AgentRunStream } from './runs.js'

function randomRunId(): string {
  return randomUUID()
}

export class AgentWorkflowActionsResource {
  /** @internal */
  constructor(
    private readonly http: HttpClient,
    private readonly config: ModusConfig,
  ) {}

  /**
   * Execute a workflow action and stream run events.
   *
   * @param body - Action body (`organizationId`, `sessionId`, `workflowAction`, optional `previousOutputs`).
   * @param options.idempotencyKey - Client-supplied idempotency key; defaults to `body.runId` or a new uuid.
   * @returns A stream of run events for the action execution.
   */
  execute(
    body: WorkflowActionRequest,
    options: { idempotencyKey?: string } = {},
  ): AgentRunStream {
    const runId = options.idempotencyKey?.trim() || body.runId?.trim() || randomRunId()
    const op = getOperation('WorkflowActionsController_execute')
    const path = formatOperationPath('WorkflowActionsController_execute')
    const lines = this.http.streamPost(path, body, {
      baseUrl: operationBaseUrl(this.http, op),
      headers: { 'Idempotency-Key': runId },
    })
    return makeAgentRunStream(runId, this.parseEvents(lines))
  }

  /**
   * Cancel a workflow action run.
   *
   * @param runId - Action run id to cancel.
   */
  async cancel(runId: string): Promise<void> {
    validateId(runId, 'run_id')
    await invokeWithRetry(this.config, this.http, 'WorkflowActionsController_cancel', {
      pathParams: { runId },
      jsonBody: {},
    })
  }

  private async *parseEvents(lines: AsyncIterable<string>): AsyncGenerator<RunEvent> {
    yield* parseSseStream(lines)
  }
}
