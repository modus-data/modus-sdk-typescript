import {
  ModusError,
  RunCancelledError,
  StreamTimeoutError,
} from './_exceptions.js'
import { requireAgentHost, type ModusConfig } from './_config.js'
import { resolveAgentRunSessionId } from './_agent_run_request.js'
import type { HttpClient } from './_http.js'
import { parseSseStream } from './_streaming.js'
import { validateChatModel, validateId } from './_validation.js'
import type { ChatModel, ChatResult } from './types/chat.js'
import type { ApprovalRequiredEvent, RunEvent } from './types/runs.js'

/** What a chat talks to: a scope, a workflow, or Modus itself. */
export type ChatTarget =
  | { readonly kind: 'scopes' | 'workflows'; readonly id: number | string }
  | { readonly kind: 'modus' }

/** Options shared by every `chat()` method. */
export interface ChatOptions {
  /** Canonical model id for this run (required). See {@link ChatModel}. */
  model: ChatModel
  /** Continue this conversation; omit to start a new one. */
  threadId?: string
}

interface ChatRequest {
  readonly path: string
  readonly body: Record<string, unknown>
  readonly sessionId: string
  readonly baseUrl: string
}

function effectiveThreadId(threadId?: string): string | undefined {
  if (threadId === undefined || !threadId.trim()) return undefined
  return threadId
}

function runsPath(target: ChatTarget): string {
  if (target.kind === 'modus') return '/agent/v1/modus/runs'
  return `/agent/v1/${target.kind}/${encodeURIComponent(String(target.id))}/runs`
}

function raiseForEvent(event: RunEvent): RunEvent {
  if (event.type === 'error') throw new ModusError(event.message, { requestId: event.requestId })
  if (event.type === 'cancelled') throw new RunCancelledError()
  if (event.type === 'stream_timeout') throw new StreamTimeoutError()
  return event
}

/**
 * One chat turn, streamed live from the agent host.
 *
 * Iterate {@link ChatSession.textStream} for tokens as they arrive, or
 * `await` the session for the final {@link ChatResult}. The request is sent
 * once: iterating again, or awaiting after iterating, replays what arrived.
 *
 * @example
 * ```ts
 * const chat = client.scopes.chat(scopeId, 'What is our ARR trend?', { model: 'claude-sonnet-5.5' })
 * for await (const token of chat.textStream()) process.stdout.write(token)
 * const { threadId } = await chat
 * ```
 */
export class ChatSession implements PromiseLike<ChatResult> {
  private readonly received: RunEvent[] = []
  private live: AsyncGenerator<RunEvent> | undefined
  private finished = false
  private failure: unknown
  private final: ChatResult | undefined
  private approval: ApprovalRequiredEvent | undefined

  /**
   * @internal A session built with `failure` never sends; every read rejects
   * with it, as the promise `chat()` used to return did.
   */
  constructor(
    private readonly http: HttpClient,
    private readonly request: ChatRequest | undefined,
    failure?: unknown,
  ) {
    if (failure !== undefined) {
      this.failure = failure
      this.finished = true
    }
  }

  /**
   * The assistant's reply as text chunks, as they arrive. Sub-agent output is
   * left out.
   *
   * @throws {ModusError} When the run reports an error.
   * @throws {RunCancelledError} When the run is cancelled.
   * @throws {StreamTimeoutError} When the run times out.
   */
  async *textStream(): AsyncGenerator<string> {
    // A replay of a protocol-2 stream can hold resets; text before the last one was replaced.
    // ponytail: a reset arriving live after text was yielded cannot be taken back.
    const lastReset = this.received.findLastIndex(
      (event) => event.type === 'assistant_content_reset' && event.subAgent === undefined,
    )
    let index = 0
    for await (const event of this.replay(false)) {
      const at = index++
      if (at < lastReset) continue
      if (at === lastReset && event.type === 'assistant_content_reset') {
        if (event.content) yield event.content
      } else if (event.type === 'token' && event.subAgent === undefined) {
        yield event.content
      }
    }
  }

  /**
   * Every run event (tokens, approvals, `done`, …) as it arrives.
   *
   * @throws {ModusError} When the run reports an error.
   * @throws {RunCancelledError} When the run is cancelled.
   * @throws {StreamTimeoutError} When the run times out.
   */
  eventStream(): AsyncGenerator<RunEvent> {
    return this.replay(true)
  }

  /**
   * Waits for the run to finish and returns its final answer. `approval` is
   * set when the run stopped for a decision; continue with {@link resume}.
   *
   * @throws {ModusError} When the run reports an error or ends without finishing.
   */
  async result(): Promise<ChatResult> {
    for await (const _event of this.replay(true)) {
      // drain
    }
    if (this.final === undefined) throw new ModusError('Chat stream ended without a done event')
    return this.final
  }

  /** Resolve with the final {@link ChatResult}, so the session can be awaited. */
  then<TResult1 = ChatResult, TResult2 = never>(
    onfulfilled?: ((value: ChatResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.result().then(onfulfilled, onrejected)
  }

  /** Handle a failed run, as on the promise `chat()` used to return. */
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<ChatResult | TResult> {
    return this.result().catch(onrejected)
  }

  /** Run `onfinally` once the run settles, as on the promise `chat()` used to return. */
  finally(onfinally?: (() => void) | null): Promise<ChatResult> {
    return this.result().finally(onfinally)
  }

  /**
   * Approve or deny the action this run stopped for, continuing the same
   * conversation.
   *
   * @param input.decision - `approve` or `deny`.
   * @returns A new session for the continued run.
   * @throws {ModusError} When called before the run has finished.
   *
   * @example
   * ```ts
   * const chat = client.modus.chat('Fix the typo in accounts', { model: 'claude-sonnet-5.5' })
   * const first = await chat
   * if (first.approval) {
   *   const done = await chat.resume({ decision: 'approve' })
   * }
   * ```
   */
  resume(input: { decision: 'approve' | 'deny' }): ChatSession {
    if (this.final === undefined) {
      throw new ModusError('resume() needs a finished run: await the chat first')
    }
    const { runId, threadId } = this.final
    validateId(runId, 'run_id')
    return new ChatSession(this.http, {
      path: `/agent/v1/runs/${encodeURIComponent(runId)}/resume`,
      body: { sessionId: threadId, decision: input.decision },
      sessionId: threadId,
      baseUrl: this.request!.baseUrl,
    })
  }

  /**
   * Stop reading the run and release its connection. Call it when you stop
   * iterating before the run ends; a session that reached `done` has already
   * let go. The run itself keeps going on the server.
   */
  async close(): Promise<void> {
    this.finished = true
    await this.live?.return(undefined)
  }

  // ponytail: one consumer at a time; concurrent iterators would race on `live`.
  private async *replay(resetAware: boolean): AsyncGenerator<RunEvent> {
    let index = 0
    while (true) {
      if (index < this.received.length) {
        yield this.received[index++]!
        continue
      }
      if (this.failure !== undefined) throw this.failure
      if (this.finished) return
      this.live ??= this.open(resetAware)
      try {
        const next = await this.live.next()
        if (next.done) {
          this.finished = true
        } else {
          this.received.push(next.value)
          // done is the last event: release the connection now, even if the consumer stops here.
          if (next.value.type === 'done') await this.close()
        }
      } catch (error) {
        this.failure = error
        throw error
      }
    }
  }

  private async *open(resetAware: boolean): AsyncGenerator<RunEvent> {
    const request = this.request!
    const body = resetAware ? { ...request.body, streamProtocolVersion: 2 } : request.body
    const lines = this.http.streamPost(request.path, body, { baseUrl: request.baseUrl })
    for await (const event of parseSseStream(lines)) {
      raiseForEvent(event)
      if (event.type === 'approval_required') this.approval = event
      if (event.type === 'done') {
        // Recorded before yielding: a consumer may stop at done and resume().
        this.final = {
          content: event.content ?? '',
          threadId: event.threadId || this.request!.sessionId,
          runId: event.runId,
          ...(this.approval !== undefined ? { approval: this.approval } : {}),
        }
        yield event
        return
      }
      yield event
    }
  }
}

export function startChat(
  http: HttpClient,
  config: ModusConfig,
  target: ChatTarget,
  message: string,
  options: ChatOptions,
): ChatSession {
  try {
    return new ChatSession(http, chatRequest(config, target, message, options))
  } catch (error) {
    return new ChatSession(http, undefined, error)
  }
}

function chatRequest(
  config: ModusConfig,
  target: ChatTarget,
  message: string,
  options: ChatOptions,
): ChatRequest {
  if (target.kind !== 'modus') validateId(target.id, `${target.kind.slice(0, -1)}_id`)
  validateChatModel(options.model)
  const baseUrl = requireAgentHost(config)
  const sessionId = resolveAgentRunSessionId(effectiveThreadId(options.threadId))
  return {
    path: runsPath(target),
    body: {
      message,
      config: { model: options.model },
      sessionId,
      ...(config.organizationId !== undefined ? { organizationId: config.organizationId } : {}),
    },
    sessionId,
    baseUrl,
  }
}
