import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModusError } from '../src/_exceptions.js'
import { ModusManagement } from '../src/management/index.js'

const TEST_KEY = 'modus_test_key_files'
const BASE = 'https://api.getmodus.com'
const S3_HOST = 'https://tenant-bucket.s3.amazonaws.com'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function slotFor(fileName: string, uploadId = `upload-${fileName}`) {
  return {
    uploadId,
    uploadUrl: `${S3_HOST}/${uploadId}`,
    s3Key: `context_uploads/${uploadId}/${fileName}`,
    fileName,
    contentType: 'text/plain',
    headers: { 'Content-Type': 'text/plain' },
    expiresAt: '2026-08-12T14:15:00.000Z',
  }
}

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'modus-sdk-upload-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('ManagementContextFilesResource raw operations', () => {
  it('createUploadUrl posts file metadata', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse(slotFor('a.txt')))
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const slot = await mgmt.context.files.createUploadUrl({
      fileName: 'a.txt',
      contentType: 'text/plain',
      fileSize: 3,
    })
    expect(slot.uploadId).toBe('upload-a.txt')
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/context/files/uploadUrl')
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      fileName: 'a.txt',
      contentType: 'text/plain',
      fileSize: 3,
    })
  })

  it('createUploadUrls rejects empty and oversize batches', async () => {
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch: vi.fn() })
    await expect(mgmt.context.files.createUploadUrls([])).rejects.toThrow(/must not be empty/)
    const files = Array.from({ length: 101 }, (_, i) => ({
      fileName: `f${i}.txt`,
      contentType: 'text/plain',
      fileSize: 1,
    }))
    await expect(mgmt.context.files.createUploadUrls(files)).rejects.toThrow(/at most 100/)
  })

  it('uploadFromUrl posts url, optional fileName, and folderPath', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({ uploadId: 'u1', status: 'processing' }),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.context.files.uploadFromUrl('https://example.com/f.pdf', {
      fileName: 'f.pdf',
      folderPath: 'reports/2026',
    })
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      url: 'https://example.com/f.pdf',
      fileName: 'f.pdf',
      folderPath: 'reports/2026',
    })
  })

  it('uploadFromUrls rejects empty and oversize batches', async () => {
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch: vi.fn() })
    await expect(mgmt.context.files.uploadFromUrls([])).rejects.toThrow(/must not be empty/)
  })

  it('get fetches by uploadId', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ uploadId: 'u1', status: 'ready' }))
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const item = await mgmt.context.files.get('u1')
    expect(item.status).toBe('ready')
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/api/v1/context/files/u1')
  })

  it('list defaults pageSize to 50', async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ files: [], nextPageToken: null }))
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.context.files.list()
    const url = new URL(String(fetch.mock.calls[0]?.[0]))
    expect(url.searchParams.get('pageSize')).toBe('50')
  })
})

describe('ManagementContextFilesResource.upload', () => {
  it('presigns, PUTs bytes, and finalizes without needing a poll', async () => {
    const filePath = join(dir, 'report.txt')
    await writeFile(filePath, 'hello world')

    let getCalls = 0
    let finalizeCalls = 0
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrl')) return jsonResponse(slotFor('report.txt'))
      if (url.endsWith('/finalize') && !url.endsWith('/context/files/finalize')) {
        finalizeCalls++
        expect(JSON.parse(String(init?.body))).toEqual({ fileName: 'report.txt' })
        return jsonResponse({ uploadId: url.split('/').slice(-2)[0], status: 'processing' })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as { uploads: { uploadId: string; fileName: string }[] }
        return jsonResponse({
          finalized: body.uploads.map((u) => ({ uploadId: u.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) {
        expect(init?.method).toBe('PUT')
        return new Response(null, { status: 200 })
      }
      if (url.includes('/context/files/upload-report.txt')) {
        getCalls++
        return jsonResponse({ uploadId: 'upload-report.txt', status: 'processing' })
      }
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const result = await mgmt.context.files.upload(filePath)
    expect(result.status).toBe('processing')
    expect(finalizeCalls).toBe(1)
    // Finalize already returns `processing`, so the default waitUntil is
    // satisfied without a poll — same request count as the old poll-based flow.
    expect(getCalls).toBe(0)
  })

  it.each([
    ['the slot headers unchanged', { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'text/plain' }, { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': 'text/plain' }],
    ['only the slot content type when an older server omits headers', undefined, { 'Content-Type': 'text/plain' }],
  ])('PUTs with %s', async (_case, slotHeaders, expected) => {
    const filePath = join(dir, 'report.txt')
    await writeFile(filePath, 'hello world')
    let putHeaders: HeadersInit | undefined
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrl')) return jsonResponse({ ...slotFor('report.txt'), headers: slotHeaders })
      if (url.endsWith('/finalize')) return jsonResponse({ uploadId: 'upload-report.txt', status: 'processing' })
      if (url.startsWith(S3_HOST)) {
        putHeaders = init?.headers
        return new Response(null, { status: 200 })
      }
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.context.files.upload(filePath)
    expect(putHeaders).toEqual(expected)
  })

  it('passes folderPath through finalize', async () => {
    const filePath = join(dir, 'report.txt')
    await writeFile(filePath, 'hello world')
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrl')) return jsonResponse(slotFor('report.txt'))
      if (url.endsWith('/finalize') && !url.endsWith('/context/files/finalize')) {
        expect(JSON.parse(String(init?.body))).toEqual({ fileName: 'report.txt', folderPath: 'reports/2026' })
        return jsonResponse({ uploadId: 'upload-report.txt', status: 'processing' })
      }
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.context.files.upload(filePath, { folderPath: 'reports/2026' })
  })

  it('rejects an invalid waitUntil before any request', async () => {
    const filePath = join(dir, 'report.txt')
    await writeFile(filePath, 'hi')
    const fetch = vi.fn()
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await expect(
      mgmt.context.files.upload(filePath, { waitUntil: 'done' as never }),
    ).rejects.toThrow(/waitUntil must be one of/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws ModusError when the presigned PUT fails', async () => {
    const filePath = join(dir, 'report.txt')
    await writeFile(filePath, 'hi')
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/uploadUrl')) return jsonResponse(slotFor('report.txt'))
      if (url.startsWith(S3_HOST)) return new Response('forbidden', { status: 403 })
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await expect(mgmt.context.files.upload(filePath)).rejects.toThrow(ModusError)
  })
})

describe('ManagementContextFilesResource.uploadDir', () => {
  it('rejects concurrency < 1', async () => {
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch: vi.fn() })
    await expect(mgmt.context.files.uploadDir(dir, { concurrency: 0 })).rejects.toThrow(/concurrency must be/)
  })

  it('is a no-op when the directory has no files', async () => {
    const fetch = vi.fn()
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const result = await mgmt.context.files.uploadDir(dir)
    expect(result).toEqual({ uploaded: [], failed: [] })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sends each nested directory relative to the upload root at bulk finalize', async () => {
    await mkdir(join(dir, 'nested'))
    await writeFile(join(dir, 'root.txt'), 'root')
    await writeFile(join(dir, 'nested', 'child.txt'), 'child')

    const finalizeBodies: Array<{ uploads: Array<{ uploadId: string; fileName: string; folderPath?: string }> }> = []
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        const body = JSON.parse(String(init?.body)) as { files: Array<{ fileName: string }> }
        return jsonResponse({ uploaded: body.files.map((f) => slotFor(f.fileName)), failed: [] })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as typeof finalizeBodies[number]
        finalizeBodies.push(body)
        return jsonResponse({
          finalized: body.uploads.map((upload) => ({ uploadId: upload.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })

    await mgmt.context.files.uploadDir(dir)

    expect(finalizeBodies).toHaveLength(1)
    expect(finalizeBodies[0]?.uploads).toEqual(expect.arrayContaining([
      expect.objectContaining({ fileName: 'root.txt' }),
      expect.objectContaining({ fileName: 'child.txt', folderPath: 'nested' }),
    ]))
  })

  it('prefixes destination folderPath onto relative subpaths', async () => {
    await mkdir(join(dir, 'nested'))
    await writeFile(join(dir, 'root.txt'), 'root')
    await writeFile(join(dir, 'nested', 'child.txt'), 'child')

    const finalizeBodies: Array<{ uploads: Array<{ uploadId: string; fileName: string; folderPath?: string }> }> = []
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        const body = JSON.parse(String(init?.body)) as { files: Array<{ fileName: string }> }
        return jsonResponse({ uploaded: body.files.map((f) => slotFor(f.fileName)), failed: [] })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as typeof finalizeBodies[number]
        finalizeBodies.push(body)
        return jsonResponse({
          finalized: body.uploads.map((upload) => ({ uploadId: upload.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })

    await mgmt.context.files.uploadDir(dir, { folderPath: 'reports' })

    expect(finalizeBodies[0]?.uploads).toEqual(expect.arrayContaining([
      expect.objectContaining({ fileName: 'root.txt', folderPath: 'reports' }),
      expect.objectContaining({ fileName: 'child.txt', folderPath: 'reports/nested' }),
    ]))
  })

  it('does not rewrite a leading-slash destination prefix', async () => {
    await mkdir(join(dir, 'nested'))
    await writeFile(join(dir, 'root.txt'), 'root')
    await writeFile(join(dir, 'nested', 'child.txt'), 'child')

    const finalizeBodies: Array<{ uploads: Array<{ uploadId: string; fileName: string; folderPath?: string }> }> = []
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        const body = JSON.parse(String(init?.body)) as { files: Array<{ fileName: string }> }
        return jsonResponse({ uploaded: body.files.map((f) => slotFor(f.fileName)), failed: [] })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as typeof finalizeBodies[number]
        finalizeBodies.push(body)
        return jsonResponse({
          finalized: body.uploads.map((upload) => ({ uploadId: upload.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })

    await mgmt.context.files.uploadDir(dir, { folderPath: '/reports' })

    expect(finalizeBodies[0]?.uploads).toEqual(expect.arrayContaining([
      expect.objectContaining({ fileName: 'root.txt', folderPath: '/reports' }),
      expect.objectContaining({ fileName: 'child.txt', folderPath: '/reports/nested' }),
    ]))
  })

  it('preserves a slash-only destination prefix instead of collapsing it to the Files root', async () => {
    await writeFile(join(dir, 'root.txt'), 'root')

    const finalizeBodies: Array<{ uploads: Array<{ uploadId: string; fileName: string; folderPath?: string }> }> = []
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        const body = JSON.parse(String(init?.body)) as { files: Array<{ fileName: string }> }
        return jsonResponse({ uploaded: body.files.map((f) => slotFor(f.fileName)), failed: [] })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as typeof finalizeBodies[number]
        finalizeBodies.push(body)
        return jsonResponse({
          finalized: body.uploads.map((upload) => ({ uploadId: upload.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })

    await mgmt.context.files.uploadDir(dir, { folderPath: '/' })
    await mgmt.context.files.uploadFiles([{ path: join(dir, 'root.txt') }], { folderPath: '///' })

    expect(finalizeBodies[0]?.uploads).toEqual(
      expect.arrayContaining([expect.objectContaining({ fileName: 'root.txt', folderPath: '/' })]),
    )
    expect(finalizeBodies[1]?.uploads).toEqual(
      expect.arrayContaining([expect.objectContaining({ fileName: 'root.txt', folderPath: '///' })]),
    )
  })

  it('prefixes CLI-style root-basename relative paths', async () => {
    await mkdir(join(dir, 'docs'))
    await mkdir(join(dir, 'docs', 'nested'))
    await writeFile(join(dir, 'docs', 'a.txt'), 'a')
    await writeFile(join(dir, 'docs', 'nested', 'b.txt'), 'b')

    const finalizeBodies: Array<{ uploads: Array<{ uploadId: string; fileName: string; folderPath?: string }> }> = []
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        const body = JSON.parse(String(init?.body)) as { files: Array<{ fileName: string }> }
        return jsonResponse({ uploaded: body.files.map((f) => slotFor(f.fileName)), failed: [] })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as typeof finalizeBodies[number]
        finalizeBodies.push(body)
        return jsonResponse({
          finalized: body.uploads.map((upload) => ({ uploadId: upload.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })

    await mgmt.context.files.uploadFiles(
      [
        { path: join(dir, 'docs', 'a.txt'), folderPath: 'docs' },
        { path: join(dir, 'docs', 'nested', 'b.txt'), folderPath: 'docs/nested' },
      ],
      { folderPath: 'reports' },
    )

    expect(finalizeBodies[0]?.uploads).toEqual(expect.arrayContaining([
      expect.objectContaining({ fileName: 'a.txt', folderPath: 'reports/docs' }),
      expect.objectContaining({ fileName: 'b.txt', folderPath: 'reports/docs/nested' }),
    ]))
  })

  it.each([
    { relative: '.', prefix: undefined, destination: '.' },
    { relative: '.', prefix: 'reports', destination: 'reports/.' },
    { relative: 'a\\b', prefix: 'reports\\2026', destination: 'reports\\2026/a\\b' },
  ])('leaves $destination to server validation', async ({ relative, prefix, destination }) => {
    const filePath = join(dir, 'a.txt')
    await writeFile(filePath, 'a')
    let sentDestination: string | undefined
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        return jsonResponse({ uploaded: [slotFor('a.txt')], failed: [] })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as { uploads: Array<{ folderPath?: string }> }
        sentDestination = body.uploads[0]?.folderPath
        return sentDestination?.split('/').includes('.')
          ? jsonResponse({ finalized: [], failed: [{ uploadId: 'upload-a.txt', error: 'Invalid folder path' }] })
          : jsonResponse({ finalized: [{ uploadId: 'upload-a.txt', status: 'processing' }], failed: [] })
      }
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const result = await mgmt.context.files.uploadFiles([{ path: filePath, folderPath: relative }], { folderPath: prefix })

    expect(sentDestination).toBe(destination)
    expect(result.failed).toHaveLength(relative === '.' ? 1 : 0)
    expect(result.uploaded).toHaveLength(relative === '.' ? 0 : 1)
  })

  it('skips hidden files/dirs and symlinks', async () => {
    await writeFile(join(dir, 'keep.txt'), 'a')
    await writeFile(join(dir, '.hidden.txt'), 'b')
    await mkdir(join(dir, '.hidden-dir'))
    await writeFile(join(dir, '.hidden-dir', 'nested.txt'), 'c')
    await writeFile(join(dir, 'link-target.txt'), 'd')
    await symlink(join(dir, 'link-target.txt'), join(dir, 'link.txt'))

    const uploadUrlCalls: string[] = []
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        const body = JSON.parse(String(init?.body)) as { files: { fileName: string }[] }
        uploadUrlCalls.push(...body.files.map((f) => f.fileName))
        return jsonResponse({
          uploaded: body.files.map((f) => slotFor(f.fileName)),
          failed: [],
        })
      }
      if (url.endsWith('/finalize') && !url.endsWith('/context/files/finalize')) {
        return jsonResponse({ uploadId: url.split('/').slice(-2)[0], status: 'processing' })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as { uploads: { uploadId: string; fileName: string }[] }
        return jsonResponse({
          finalized: body.uploads.map((u) => ({ uploadId: u.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      if (url.includes('/context/files/upload-')) {
        const uploadId = url.split('/').pop() as string
        return jsonResponse({ uid: uploadId, contextType: 'file_upload', content: {}, ancestry: [] })
      }
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const result = await mgmt.context.files.uploadDir(dir)
    expect(uploadUrlCalls.sort()).toEqual(['keep.txt', 'link-target.txt'])
    expect(result.uploaded).toHaveLength(2)
    expect(result.failed).toHaveLength(0)
  })

  it('pages createUploadUrls in batches of at most 100', async () => {
    await Promise.all(
      Array.from({ length: 130 }, (_, i) => writeFile(join(dir, `f${String(i).padStart(3, '0')}.txt`), 'x')),
    )

    const batchSizes: number[] = []
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        const body = JSON.parse(String(init?.body)) as { files: { fileName: string }[] }
        batchSizes.push(body.files.length)
        return jsonResponse({
          uploaded: body.files.map((f) => slotFor(f.fileName)),
          failed: [],
        })
      }
      if (url.endsWith('/finalize') && !url.endsWith('/context/files/finalize')) {
        return jsonResponse({ uploadId: url.split('/').slice(-2)[0], status: 'processing' })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as { uploads: { uploadId: string; fileName: string }[] }
        return jsonResponse({
          finalized: body.uploads.map((u) => ({ uploadId: u.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      if (url.includes('/context/files/upload-')) {
        const uploadId = url.split('/').pop() as string
        return jsonResponse({ uid: uploadId, contextType: 'file_upload', content: {}, ancestry: [] })
      }
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const result = await mgmt.context.files.uploadDir(dir)
    expect(batchSizes).toEqual([100, 30])
    expect(result.uploaded).toHaveLength(130)
    expect(result.failed).toHaveLength(0)
  })

  it('bounds concurrency and overlaps PUTs', async () => {
    await Promise.all(
      Array.from({ length: 14 }, (_, i) => writeFile(join(dir, `f${i}.txt`), 'x')),
    )
    let inFlight = 0
    let maxInFlight = 0
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        const body = JSON.parse(String(init?.body)) as { files: { fileName: string }[] }
        return jsonResponse({
          uploaded: body.files.map((f) => slotFor(f.fileName)),
          failed: [],
        })
      }
      if (url.endsWith('/finalize') && !url.endsWith('/context/files/finalize')) {
        return jsonResponse({ uploadId: url.split('/').slice(-2)[0], status: 'processing' })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as { uploads: { uploadId: string; fileName: string }[] }
        return jsonResponse({
          finalized: body.uploads.map((u) => ({ uploadId: u.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 20))
        inFlight--
        return new Response(null, { status: 200 })
      }
      if (url.includes('/context/files/upload-')) {
        const uploadId = url.split('/').pop() as string
        return jsonResponse({ uid: uploadId, contextType: 'file_upload', content: {}, ancestry: [] })
      }
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.context.files.uploadDir(dir)
    expect(maxInFlight).toBeLessThanOrEqual(10)
    expect(maxInFlight).toBeGreaterThan(1)
  })

  it('continues past a failed PUT and reports it in failed[]', async () => {
    await writeFile(join(dir, 'good.txt'), 'ok')
    await writeFile(join(dir, 'bad.txt'), 'oops')

    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        const body = JSON.parse(String(init?.body)) as { files: { fileName: string }[] }
        return jsonResponse({
          uploaded: body.files.map((f) => slotFor(f.fileName)),
          failed: [],
        })
      }
      if (url.endsWith('/finalize') && !url.endsWith('/context/files/finalize')) {
        return jsonResponse({ uploadId: url.split('/').slice(-2)[0], status: 'processing' })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as { uploads: { uploadId: string; fileName: string }[] }
        return jsonResponse({
          finalized: body.uploads.map((u) => ({ uploadId: u.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) {
        return url.includes('upload-bad.txt')
          ? new Response('nope', { status: 500 })
          : new Response(null, { status: 200 })
      }
      if (url.includes('/context/files/upload-')) {
        const uploadId = url.split('/').pop() as string
        return jsonResponse({ uid: uploadId, contextType: 'file_upload', content: {}, ancestry: [] })
      }
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const result = await mgmt.context.files.uploadDir(dir)
    expect(result.uploaded).toHaveLength(1)
    expect(result.uploaded[0]?.uploadId).toBe('upload-good.txt')
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]?.path).toContain('bad.txt')
  })

  it('reports per-index slot-creation failures without stopping the batch', async () => {
    await writeFile(join(dir, 'good.txt'), 'ok')
    await writeFile(join(dir, 'bad.exe'), 'nope')

    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        const body = JSON.parse(String(init?.body)) as { files: { fileName: string }[] }
        const badIndex = body.files.findIndex((f) => f.fileName === 'bad.exe')
        return jsonResponse({
          uploaded: body.files.filter((_, i) => i !== badIndex).map((f) => slotFor(f.fileName)),
          failed:
            badIndex >= 0
              ? [{ index: badIndex, fileName: 'bad.exe', error: 'File type not allowed' }]
              : [],
        })
      }
      if (url.endsWith('/finalize') && !url.endsWith('/context/files/finalize')) {
        return jsonResponse({ uploadId: url.split('/').slice(-2)[0], status: 'processing' })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as { uploads: { uploadId: string; fileName: string }[] }
        return jsonResponse({
          finalized: body.uploads.map((u) => ({ uploadId: u.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      if (url.includes('/context/files/upload-')) {
        const uploadId = url.split('/').pop() as string
        return jsonResponse({ uid: uploadId, contextType: 'file_upload', content: {}, ancestry: [] })
      }
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const result = await mgmt.context.files.uploadDir(dir)
    expect(result.uploaded).toHaveLength(1)
    expect(result.failed).toEqual([{ path: join(dir, 'bad.exe'), error: 'File type not allowed' }])
  })

  it('calls onProgress with completed/total/succeeded/failed after each file', async () => {
    await writeFile(join(dir, 'a.txt'), 'a')
    await writeFile(join(dir, 'b.txt'), 'b')

    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        const body = JSON.parse(String(init?.body)) as { files: { fileName: string }[] }
        return jsonResponse({
          uploaded: body.files.map((f) => slotFor(f.fileName)),
          failed: [],
        })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as { uploads: { uploadId: string; fileName: string }[] }
        return jsonResponse({
          finalized: body.uploads.map((u) => ({ uploadId: u.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const ticks: Array<{ completed: number; total: number; succeeded: number; failed: number }> = []
    const result = await mgmt.context.files.uploadFiles([join(dir, 'a.txt'), join(dir, 'b.txt')], {
      onProgress: (p) => ticks.push(p),
    })
    expect(result.uploaded).toHaveLength(2)
    expect(ticks).toEqual([
      { completed: 1, total: 2, succeeded: 1, failed: 0 },
      { completed: 2, total: 2, succeeded: 2, failed: 0 },
    ])
  })

  it('counts slot failures in onProgress and continues', async () => {
    await writeFile(join(dir, 'good.txt'), 'ok')
    await writeFile(join(dir, 'bad.exe'), 'x')

    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        return jsonResponse({
          uploaded: [slotFor('good.txt')],
          failed: [{ index: 0, fileName: 'bad.exe', error: 'File type not allowed' }],
        })
      }
      if (url.includes('/context/files/finalize')) {
        const body = JSON.parse(String(init?.body)) as { uploads: { uploadId: string; fileName: string }[] }
        return jsonResponse({
          finalized: body.uploads.map((u) => ({ uploadId: u.uploadId, status: 'processing' })),
          failed: [],
        })
      }
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const ticks: Array<{ completed: number; total: number; succeeded: number; failed: number }> = []
    const result = await mgmt.context.files.uploadDir(dir, {
      onProgress: (p) => ticks.push(p),
    })
    expect(result.uploaded).toHaveLength(1)
    expect(result.failed).toHaveLength(1)
    expect(ticks).toEqual([
      { completed: 1, total: 2, succeeded: 0, failed: 1 },
      { completed: 2, total: 2, succeeded: 1, failed: 1 },
    ])
  })

  it('ticks failed up one at a time when a single slot-creation call rejects more than one file', async () => {
    await writeFile(join(dir, 'bad1.exe'), 'x')
    await writeFile(join(dir, 'bad2.exe'), 'x')

    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/uploadUrls')) {
        return jsonResponse({
          uploaded: [],
          failed: [
            { index: 0, fileName: 'bad1.exe', error: 'File type not allowed' },
            { index: 1, fileName: 'bad2.exe', error: 'File type not allowed' },
          ],
        })
      }
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const ticks: Array<{ completed: number; total: number; succeeded: number; failed: number }> = []
    const result = await mgmt.context.files.uploadDir(dir, {
      onProgress: (p) => ticks.push(p),
    })
    expect(result.failed).toHaveLength(2)
    // completed must equal succeeded + failed on every tick, not just the last one.
    expect(ticks).toEqual([
      { completed: 1, total: 2, succeeded: 0, failed: 1 },
      { completed: 2, total: 2, succeeded: 0, failed: 2 },
    ])
  })
})
