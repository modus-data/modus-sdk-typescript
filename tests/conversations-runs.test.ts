import { describe, expect, it, vi } from 'vitest'
import { Modus } from '../src/index.js'
import { conversationSkillId } from '../src/types/conversations.js'

const TEST_KEY = 'modus_test_key_conversations'
const BASE = 'https://api.modus.com'

function makeListItem(i = 0) {
  return {
    threadId: `thread-${i}`,
    skillId: 42,
    firstMessage: `Hello from thread ${i}`,
    title: null,
    messageCount: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    userIds: ['user-abc'],
  }
}

describe('scopes.conversations', () => {
  it('list returns conversation summaries', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ conversations: [makeListItem(0)], nextPageToken: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const page = await client.scopes.conversations(42).list()
    expect(page.items[0]?.threadId).toBe('thread-0')
    expect(page.items[0]?.firstMessage).toBe('Hello from thread 0')
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/scopes/42/conversations')
  })

  it('get returns full conversation', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          threadId: 'thread-abc',
          skillId: 42,
          messages: [
            { type: 'human', content: 'Hello' },
            { type: 'ai', content: 'Hi there!', toolCalls: [] },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const conv = await client.scopes.conversations(42).get('thread-abc')
    expect(conv.messages).toHaveLength(2)
    expect(conv.messages[0]?.type).toBe('human')
  })

  it('get sends messageLimit and beforeMessageIndex when provided', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          threadId: 'thread-abc',
          skillId: 42,
          messages: [],
          messageWindow: {
            startIndex: 90,
            endIndex: 120,
            totalMessages: 120,
            hasMoreBefore: true,
            hasMoreAfter: false,
          },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const conv = await client.scopes.conversations(42).get('thread-abc', {
      messageLimit: 30,
      beforeMessageIndex: 120,
    })
    const url = new URL(String(fetch.mock.calls[0]?.[0]))
    expect(url.searchParams.get('messageLimit')).toBe('30')
    expect(url.searchParams.get('beforeMessageIndex')).toBe('120')
    expect(conv.messageWindow?.startIndex).toBe(90)
  })

  it('get omits window params when not provided', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          threadId: 'thread-abc',
          skillId: 42,
          messages: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await client.scopes.conversations(42).get('thread-abc')
    const url = new URL(String(fetch.mock.calls[0]?.[0]))
    expect(url.searchParams.has('messageLimit')).toBe(false)
    expect(url.searchParams.has('beforeMessageIndex')).toBe(false)
  })

  it('get rejects beforeMessageIndex without messageLimit', async () => {
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0 })
    await expect(
      client.scopes.conversations(42).get('thread-abc', { beforeMessageIndex: 30 }),
    ).rejects.toThrow('beforeMessageIndex requires messageLimit')
  })

  it('conversationSkillId treats 0 as direct modus', () => {
    expect(conversationSkillId({ ...makeListItem(), skillId: 0 } as never)).toBeUndefined()
    expect(conversationSkillId(makeListItem() as never)).toBe(42)
  })
})

describe('modus.conversations', () => {
  it('list with kind filter', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ conversations: [], nextPageToken: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await client.modus.conversations.list({ kind: 'modus' })
    expect(String(fetch.mock.calls[0]?.[0])).toContain('kind=modus')
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/modus/conversations')
  })
})

describe('workflows.runs', () => {
  it('list uses runs array pagination', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          runs: [{ id: 'wf_1:r1', workflowId: 'wf_1', agentId: 7, status: 'completed' }],
          nextPageToken: 'tok2',
          counts: { completed: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const page = await client.workflows.runs.list(7, { status: 'completed' })
    expect(page.items[0]?.id).toBe('wf_1:r1')
    expect(page.hasNextPage()).toBe(true)
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/workflows/7/runs')
  })

  it('get run by id', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'wf_1:r1',
          workflowId: 'wf_1',
          agentId: 7,
          agentName: 'Daily Report',
          status: 'completed',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    const client = new Modus({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const run = await client.workflows.runs.get(7, 'wf_1:r1')
    expect(run.agentName).toBe('Daily Report')
  })
})
