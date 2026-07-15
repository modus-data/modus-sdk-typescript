import { describe, expect, it } from 'vitest'
import { parseSseStream } from '../src/_streaming.js'

function lines(...parts: string[]): string[] {
  return parts
}

describe('parseSseStream', () => {
  it('parses token events', () => {
    const events = [...parseSseStream(lines('data: {"type":"token","content":"Hello"}'))]
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'token', content: 'Hello' })
  })

  it('parses data lines without a space after the colon', () => {
    const events = [...parseSseStream(lines('data:{"type":"token","content":"compact"}'))]
    expect(events).toEqual([{ type: 'token', content: 'compact' }])
  })

  it('parses multiple tokens', () => {
    const events = [...parseSseStream(lines(
      'data: {"type":"token","content":"Hello"}',
      'data: {"type":"token","content":" world"}',
    ))]
    expect(events.map((e) => (e.type === 'token' ? e.content : ''))).toEqual(['Hello', ' world'])
  })

  it('parses done with threadId', () => {
    const events = [...parseSseStream(lines(
      'data: {"type":"done","runId":"run-123","threadId":"thread-456"}',
    ))]
    expect(events[0]).toEqual({
      type: 'done',
      runId: 'run-123',
      threadId: 'thread-456',
    })
  })

  it('parses error from error or message field', () => {
    const fromError = [...parseSseStream(lines('data: {"type":"error","error":"Quota exceeded"}'))]
    expect(fromError[0]).toEqual({ type: 'error', message: 'Quota exceeded' })

    const fromMessage = [...parseSseStream(lines('data: {"type":"error","message":"Broke"}'))]
    expect(fromMessage[0]).toEqual({ type: 'error', message: 'Broke' })
  })

  it('parses cancelled and stream_timeout', () => {
    expect([...parseSseStream(lines('data: {"type":"cancelled"}'))][0]?.type).toBe('cancelled')
    expect([...parseSseStream(lines('data: {"type":"stream_timeout"}'))][0]?.type).toBe(
      'stream_timeout',
    )
  })

  it('parses assistant content replacement events', () => {
    const events = [...parseSseStream(lines(
      'data: {"type":"assistant_content_reset","content":"kept ","visibleContent":"kept ","attempt":2,"reason":"provider_stream_failed"}',
    ))]
    expect(events).toEqual([{
      type: 'assistant_content_reset',
      content: 'kept ',
      visibleContent: 'kept ',
      attempt: 2,
      reason: 'provider_stream_failed',
    }])
  })

  it('ignores assistant content replacement events without string content', () => {
    const events = [...parseSseStream(lines(
      'data: {"type":"assistant_content_reset"}',
      'data: {"type":"assistant_content_reset","content":null}',
      'data: {"type":"token","content":"kept"}',
    ))]
    expect(events).toEqual([{ type: 'token', content: 'kept' }])
  })

  it('ignores heartbeats and unknown types', () => {
    expect([...parseSseStream(lines('data: {"type":"heartbeat"}'))]).toEqual([])
    expect([...parseSseStream(lines('data: {"type":"future_event_type"}'))]).toEqual([])
  })

  it('ignores non-data lines and invalid json', () => {
    const events = [...parseSseStream(lines(
      ': keep-alive',
      '',
      'data: not-json',
      'data: [DONE]',
      'data: {"type":"token","content":"hi"}',
    ))]
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'token', content: 'hi' })
  })

  it('parses mixed stream', () => {
    const events = [...parseSseStream(lines(
      'data: {"type":"token","content":"The "}',
      'data: {"type":"agent_thinking","content":"..."}',
      'data: {"type":"token","content":"answer"}',
      'data: {"type":"heartbeat"}',
      'data: {"type":"done","runId":"run-abc","threadId":"t1"}',
    ))]
    expect(events).toHaveLength(3)
    expect(events[0]?.type).toBe('token')
    expect(events[1]?.type).toBe('token')
    expect(events[2]?.type).toBe('done')
  })
})
