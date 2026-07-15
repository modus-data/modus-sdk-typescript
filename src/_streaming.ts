import type {
  AssistantContentResetEvent,
  CancelledEvent,
  DoneEvent,
  ErrorEvent,
  RunEvent,
  StreamTimeoutEvent,
  TokenEvent,
} from './types/runs.js'

const SILENTLY_IGNORED = new Set([
  'heartbeat',
  'ws_chunk',
  'unknown',
  'tool_start',
  'tool_end',
  'tool_chunk',
  'agent_thinking',
  'warning',
  'selected_final_content',
])

function parseLine(line: string): Record<string, unknown> | undefined {
  if (!line.startsWith('data:')) return undefined
  const raw = line.slice(5).trimStart()
  if (!raw || raw === '[DONE]') return undefined
  try {
    const data = JSON.parse(raw) as unknown
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>
    }
  } catch {
    return undefined
  }
  return undefined
}

function isAsyncIterable<T>(value: Iterable<T> | AsyncIterable<T>): value is AsyncIterable<T> {
  return Symbol.asyncIterator in Object(value)
}

function* parseData(data: Record<string, unknown>): Generator<RunEvent> {
  const eventType = typeof data.type === 'string' ? data.type : 'unknown'

  if (eventType === 'token') {
    const event: TokenEvent = {
      type: 'token',
      content: typeof data.content === 'string' ? data.content : '',
    }
    yield event
  } else if (eventType === 'done') {
    const event: DoneEvent = {
      type: 'done',
      runId: typeof data.runId === 'string' ? data.runId : '',
      threadId: typeof data.threadId === 'string' ? data.threadId : '',
    }
    yield event
  } else if (eventType === 'error') {
    const msg =
      data.error ?? data.message ?? data.content ?? 'Unknown run error'
    const event: ErrorEvent = { type: 'error', message: String(msg) }
    yield event
  } else if (eventType === 'cancelled') {
    const event: CancelledEvent = { type: 'cancelled' }
    yield event
  } else if (eventType === 'stream_timeout') {
    const event: StreamTimeoutEvent = { type: 'stream_timeout' }
    yield event
  } else if (eventType === 'assistant_content_reset') {
    if (typeof data.content !== 'string') return
    const event: AssistantContentResetEvent = {
      type: 'assistant_content_reset',
      content: data.content,
      ...(typeof data.visibleContent === 'string'
        ? { visibleContent: data.visibleContent }
        : {}),
      attempt: typeof data.attempt === 'number' ? data.attempt : 1,
      reason: 'provider_stream_failed',
    }
    yield event
  } else if (!SILENTLY_IGNORED.has(eventType)) {
    // Unknown future event types ignored for forward compatibility.
    return
  }
}

function* parseSyncSseLines(lines: Iterable<string>): Generator<RunEvent> {
  for (const line of lines) {
    const data = parseLine(line)
    if (data !== undefined) yield* parseData(data)
  }
}

async function* parseAsyncSseLines(lines: AsyncIterable<string>): AsyncGenerator<RunEvent> {
  for await (const line of lines) {
    const data = parseLine(line)
    if (data !== undefined) yield* parseData(data)
  }
}

/** Convert raw SSE lines into typed run events (forward-compatible). */
export function parseSseStream(lines: Iterable<string>): Generator<RunEvent>
export function parseSseStream(lines: AsyncIterable<string>): AsyncGenerator<RunEvent>
export function parseSseStream(
  lines: Iterable<string> | AsyncIterable<string>,
): Generator<RunEvent> | AsyncGenerator<RunEvent> {
  return isAsyncIterable(lines) ? parseAsyncSseLines(lines) : parseSyncSseLines(lines)
}
