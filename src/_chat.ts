import { randomUUID } from 'node:crypto'
import {
  ModusError,
  RunCancelledError,
  StreamTimeoutError,
} from './_exceptions.js'
import type { ModusConfig } from './_config.js'
import type { HttpClient } from './_http.js'
import { parseSseStream } from './_streaming.js'
import { validateChatModel, validateId } from './_validation.js'
import type { ChatModel, ChatResult } from './types/chat.js'
import type { RunEvent } from './types/runs.js'

function effectiveThreadId(threadId?: string): string | undefined {
  if (threadId === undefined) return undefined
  if (!threadId.trim()) return undefined
  return threadId
}

function resolveSessionId(threadId?: string): string {
  return effectiveThreadId(threadId) ?? randomUUID()
}

function chatPath(
  resource: string,
  resourceId: number | string,
  options: { threadId?: string },
): string {
  const safeId = encodeURIComponent(String(resourceId))
  const tid = effectiveThreadId(options.threadId)
  if (tid !== undefined) {
    const safeTid = encodeURIComponent(tid)
    return `/api/v1/${resource}/${safeId}/conversations/${safeTid}/chat`
  }
  return `/api/v1/${resource}/${safeId}/chat`
}

function modusChatPath(options: { threadId?: string }): string {
  const tid = effectiveThreadId(options.threadId)
  if (tid !== undefined) {
    validateId(tid, 'thread_id')
    return `/api/v1/modus/conversations/${encodeURIComponent(tid)}/chat`
  }
  return `/api/v1/modus/chat`
}

function agentHostRunsPath(
  resource: 'modus' | 'scopes' | 'workflows',
  resourceId?: number | string,
): string {
  if (resource === 'modus') return '/agent/v1/modus/runs'
  const safeId = encodeURIComponent(String(resourceId))
  return `/agent/v1/${resource}/${safeId}/runs`
}

function chatBody(message: string, model: ChatModel): Record<string, string> {
  return { message, model }
}

function agentRunsBody(
  message: string,
  model: ChatModel,
  options: { sessionId: string; organizationId?: string; version?: string },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    message,
    config: { model },
    sessionId: options.sessionId,
  }
  if (options.organizationId !== undefined) {
    body.organizationId = options.organizationId
  }
  if (options.version !== undefined) {
    body.version = options.version
  }
  return body
}

function raiseForEvent(event: RunEvent): RunEvent {
  if (event.type === 'error') throw new ModusError(event.message)
  if (event.type === 'cancelled') throw new RunCancelledError()
  if (event.type === 'stream_timeout') throw new StreamTimeoutError()
  return event
}

export class ChatStream {
  private final?: ChatResult
  private readonly textParts: string[] = []

  constructor(
    private readonly http: HttpClient,
    private readonly path: string,
    private readonly body: Record<string, unknown>,
    private readonly baseUrl?: string,
  ) {}

  async *textStream(): AsyncGenerator<string> {
    for await (const event of this.events(false)) {
      if (event.type === 'token') yield event.content
    }
  }

  async *eventStream(): AsyncGenerator<RunEvent> {
    yield* this.events(true)
  }

  private async *events(supportsReset: boolean): AsyncGenerator<RunEvent> {
    const body = supportsReset
      ? { ...this.body, streamProtocolVersion: 2 }
      : this.body
    for await (const line of this.http.streamPost(this.path, body, {
      baseUrl: this.baseUrl,
    })) {
      for (const event of parseSseStream([line])) {
        const normalized = raiseForEvent(event)
        if (normalized.type === 'token') this.textParts.push(normalized.content)
        if (normalized.type === 'assistant_content_reset') {
          this.textParts.length = 0
          this.textParts.push(normalized.content)
        }
        if (normalized.type === 'done') {
          this.final = {
            content: this.textParts.join(''),
            threadId: normalized.threadId,
            runId: normalized.runId,
          }
          yield normalized
          return
        }
        yield normalized
      }
    }
  }

  getFinalResult(): ChatResult {
    if (this.final === undefined) {
      throw new ModusError(
        'Stream ended without a done event; call getFinalResult() only after consuming textStream() or eventStream().',
      )
    }
    return this.final
  }
}

export async function chatBuffered(
  http: HttpClient,
  resource: string,
  resourceId: number | string,
  message: string,
  options: { model: ChatModel; threadId?: string },
): Promise<ChatResult> {
  validateId(resourceId, `${resource}_id`)
  validateChatModel(options.model)
  const path = chatPath(resource, resourceId, {
    threadId: options.threadId,
  })
  const data = await http.post(path, chatBody(message, options.model))
  return data as ChatResult
}

export function chatStreamSession(
  http: HttpClient,
  config: ModusConfig,
  resource: 'scopes' | 'workflows',
  resourceId: number | string,
  message: string,
  options: { model: ChatModel; threadId?: string; version?: string },
): ChatStream {
  validateId(resourceId, `${resource}_id`)
  validateChatModel(options.model)
  const path = agentHostRunsPath(resource, resourceId)
  return new ChatStream(
    http,
    path,
    agentRunsBody(message, options.model, {
      sessionId: resolveSessionId(options.threadId),
      organizationId: config.organizationId,
      version: options.version,
    }),
    config.agentHost,
  )
}

export async function modusChatBuffered(
  http: HttpClient,
  message: string,
  options: { model: ChatModel; threadId?: string },
): Promise<ChatResult> {
  validateChatModel(options.model)
  const path = modusChatPath({ threadId: options.threadId })
  const data = await http.post(path, chatBody(message, options.model))
  return data as ChatResult
}

export function modusChatStreamSession(
  http: HttpClient,
  config: ModusConfig,
  message: string,
  options: { model: ChatModel; threadId?: string },
): ChatStream {
  validateChatModel(options.model)
  return new ChatStream(
    http,
    agentHostRunsPath('modus'),
    agentRunsBody(message, options.model, {
      sessionId: resolveSessionId(options.threadId),
      organizationId: config.organizationId,
    }),
    config.agentHost,
  )
}
