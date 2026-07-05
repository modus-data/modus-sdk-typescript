import {
  ModusError,
  RunCancelledError,
  StreamTimeoutError,
} from './_exceptions.js'
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

function chatPath(
  resource: string,
  resourceId: number | string,
  options: { threadId?: string; stream: boolean },
): string {
  const safeId = encodeURIComponent(String(resourceId))
  const suffix = options.stream ? '/stream' : ''
  const tid = effectiveThreadId(options.threadId)
  if (tid !== undefined) {
    const safeTid = encodeURIComponent(tid)
    return `/api/v1/${resource}/${safeId}/conversations/${safeTid}/chat${suffix}`
  }
  return `/api/v1/${resource}/${safeId}/chat${suffix}`
}

function modusChatPath(options: { threadId?: string; stream: boolean }): string {
  const suffix = options.stream ? '/stream' : ''
  const tid = effectiveThreadId(options.threadId)
  if (tid !== undefined) {
    validateId(tid, 'thread_id')
    return `/api/v1/modus/conversations/${encodeURIComponent(tid)}/chat${suffix}`
  }
  return `/api/v1/modus/chat${suffix}`
}

function chatBody(message: string, model: ChatModel): Record<string, string> {
  return { message, model }
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
  ) {}

  async *textStream(): AsyncGenerator<string> {
    for await (const event of this.eventStream()) {
      if (event.type === 'token') yield event.content
    }
  }

  async *eventStream(): AsyncGenerator<RunEvent> {
    for await (const line of this.http.streamPost(this.path, this.body)) {
      for (const event of parseSseStream([line])) {
        const normalized = raiseForEvent(event)
        if (normalized.type === 'token') this.textParts.push(normalized.content)
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
    stream: false,
  })
  const data = await http.post(path, chatBody(message, options.model))
  return data as ChatResult
}

export function chatStreamSession(
  http: HttpClient,
  resource: string,
  resourceId: number | string,
  message: string,
  options: { model: ChatModel; threadId?: string },
): ChatStream {
  validateId(resourceId, `${resource}_id`)
  validateChatModel(options.model)
  const path = chatPath(resource, resourceId, {
    threadId: options.threadId,
    stream: true,
  })
  return new ChatStream(http, path, chatBody(message, options.model))
}

export async function modusChatBuffered(
  http: HttpClient,
  message: string,
  options: { model: ChatModel; threadId?: string },
): Promise<ChatResult> {
  validateChatModel(options.model)
  const path = modusChatPath({ threadId: options.threadId, stream: false })
  const data = await http.post(path, chatBody(message, options.model))
  return data as ChatResult
}

export function modusChatStreamSession(
  http: HttpClient,
  message: string,
  options: { model: ChatModel; threadId?: string },
): ChatStream {
  validateChatModel(options.model)
  const path = modusChatPath({ threadId: options.threadId, stream: true })
  return new ChatStream(http, path, chatBody(message, options.model))
}
