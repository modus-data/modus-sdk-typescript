import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi, type Mock } from 'vitest'
import { ModusError, ValidationError } from '../src/_exceptions.js'
import { formatOperationPath } from '../src/_openapi-invoke.js'
import { Page } from '../src/_pagination.js'
import { Modus } from '../src/index.js'
import { ModusManagement } from '../src/management/index.js'
import type { ChatModel } from '../src/types/chat.js'
import type { ContextItem } from '../src/types/context.js'
import type { ConversationKind } from '../src/types/conversations.js'
import type { WaitUntil } from '../src/types/context-files.js'

// A rejected argument throws ValidationError, a ModusError, so `catch (e) { if (e instanceof ModusError) ... }` sees it.
const options = { apiKey: 'modus_test_key_validation', baseUrl: 'https://api.getmodus.com', maxRetries: 0 }
const modus = (fetch: Mock) => new Modus({ ...options, fetch })
const mgmt = (fetch: Mock) => new ModusManagement({ ...options, fetch })
const item = (fields: Partial<ContextItem>) => ({ uid: 'u-1', contextType: 'note', content: {}, ...fields }) as ContextItem

let dir: string
let file: string

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'modus-sdk-validation-'))
  file = join(dir, 'a.txt')
  await writeFile(file, 'a')
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

const SITES: [string, (fetch: Mock) => unknown][] = [
  ['scopes.list pageSize 0', (f) => modus(f).scopes.list({ pageSize: 0 })],
  ['runs.list pageSize over the max', (f) => modus(f).workflows.runs.list(1, { pageSize: 10_000 })],
  ['scopes.get blank id', (f) => modus(f).scopes.get('')],
  ['scopes.get dot-segment id', (f) => modus(f).scopes.get('..')],
  ['scopes.get fractional id', (f) => modus(f).scopes.get(1.5)],
  ['scopes.get NaN id', (f) => modus(f).scopes.get(Number.NaN)],
  ['management scopes.get fractional id', (f) => mgmt(f).scopes.get(34.5)],
  ['missing path parameter', () => formatOperationPath('ScopesController_get', {})],
  ['suggestions.list empty scopeIds', (f) => modus(f).suggestions.list({ scopeIds: [] })],
  ['scopes.chat unsupported model', (f) => modus(f).scopes.chat(7, 'hi', { model: 'nope' as ChatModel })],
  ['modus.conversations.list unknown kind', (f) => modus(f).modus.conversations.list({ kind: 'nope' as ConversationKind })],
  [
    'scopes.conversations.get beforeMessageIndex without messageLimit',
    (f) => modus(f).scopes.conversations(7).get('t-1', { beforeMessageIndex: 1 }),
  ],
  ['Page.getNextPage on the last page', (f) => new Page([], undefined, f).getNextPage()],
  ['runs.get blank runId', (f) => modus(f).workflows.runs.get(1, ' ')],
  ['runs.resume blank sessionId', (f) => modus(f).workflows.runs.resume('r-1', { decision: 'approve', sessionId: ' ' })],
  ['runs.interrupt blank sessionId', (f) => modus(f).workflows.runs.interrupt('r-1', { message: 'm', sessionId: '' })],
  ['runs.editQueued blank sessionId', (f) => modus(f).workflows.runs.editQueued('r-1', { message: 'm', sessionId: '' })],
  [
    'runs.activeBySession over 100 ids',
    (f) => modus(f).workflows.runs.activeBySession(Array.from({ length: 101 }, (_, i) => `s-${i}`)),
  ],
  ['context.items.update blank updateMask', (f) => mgmt(f).context.items.update('u-1', { updateMask: ' ' })],
  ['context.updateLink with no fields', (f) => mgmt(f).context.updateLink('u-1', {})],
  [
    'context.updateNote on another context type',
    (f) => mgmt(f).context.updateNote('u-1', { title: 't', body: 'b', existing: item({ contextType: 'link' }) }),
  ],
  [
    'context.updateNote on non-object content',
    (f) => mgmt(f).context.updateNote('u-1', { title: 't', body: 'b', existing: item({ content: 'x' }) }),
  ],
  ['files.upload unknown waitUntil', (f) => mgmt(f).context.files.upload(file, { waitUntil: 'nope' as WaitUntil })],
  ['files.upload a directory', (f) => mgmt(f).context.files.upload(dir)],
  ['files.upload a missing path', (f) => mgmt(f).context.files.upload(join(dir, 'missing.txt'))],
  ['files.upload a path under a file', (f) => mgmt(f).context.files.upload(join(file, 'child.txt'))],
  ['files.uploadDir a file', (f) => mgmt(f).context.files.uploadDir(file)],
  ['files.uploadDir a missing path', (f) => mgmt(f).context.files.uploadDir(join(dir, 'missing'))],
  ['files.uploadDir a path under a file', (f) => mgmt(f).context.files.uploadDir(join(file, 'child'))],
  ['files.uploadDir concurrency 0', (f) => mgmt(f).context.files.uploadDir(dir, { concurrency: 0 })],
  ['files.uploadFiles concurrency 0', (f) => mgmt(f).context.files.uploadFiles([file], { concurrency: 0 })],
  ['files.createUploadUrls empty', (f) => mgmt(f).context.files.createUploadUrls([])],
  [
    'files.createUploadUrls over the max',
    (f) => mgmt(f).context.files.createUploadUrls(Array.from({ length: 101 }, (_, i) => ({ fileName: `f${i}.txt` }))),
  ],
]

describe.each(SITES)('%s', (_name, call) => {
  it('throws ValidationError before any request', async () => {
    const fetch = vi.fn()
    const error = await Promise.resolve()
      .then(() => call(fetch))
      .then(
        () => undefined,
        (e: unknown) => e,
      )
    expect(error).toBeInstanceOf(ValidationError)
    expect(error).toBeInstanceOf(ModusError)
    expect(fetch).not.toHaveBeenCalled()
  })
})
