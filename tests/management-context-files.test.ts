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

  it('uploadFromUrl posts url and optional fileName', async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({ uploadId: 'u1', status: 'processing' }),
    )
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    await mgmt.context.files.uploadFromUrl('https://example.com/f.pdf', { fileName: 'f.pdf' })
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      url: 'https://example.com/f.pdf',
      fileName: 'f.pdf',
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
  it('presigns, PUTs bytes, and polls until processing', async () => {
    const filePath = join(dir, 'report.txt')
    await writeFile(filePath, 'hello world')

    let getCalls = 0
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/uploadUrl')) return jsonResponse(slotFor('report.txt'))
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
    expect(getCalls).toBe(1)
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
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      if (url.includes('/context/files/upload-')) {
        const uploadId = url.split('/').pop() as string
        return jsonResponse({ uploadId, status: 'processing' })
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
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      if (url.includes('/context/files/upload-')) {
        const uploadId = url.split('/').pop() as string
        return jsonResponse({ uploadId, status: 'processing' })
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
      if (url.startsWith(S3_HOST)) {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 20))
        inFlight--
        return new Response(null, { status: 200 })
      }
      if (url.includes('/context/files/upload-')) {
        const uploadId = url.split('/').pop() as string
        return jsonResponse({ uploadId, status: 'processing' })
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
      if (url.startsWith(S3_HOST)) {
        return url.includes('upload-bad.txt')
          ? new Response('nope', { status: 500 })
          : new Response(null, { status: 200 })
      }
      if (url.includes('/context/files/upload-')) {
        const uploadId = url.split('/').pop() as string
        return jsonResponse({ uploadId, status: 'processing' })
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
      if (url.startsWith(S3_HOST)) return new Response(null, { status: 200 })
      if (url.includes('/context/files/upload-')) {
        const uploadId = url.split('/').pop() as string
        return jsonResponse({ uploadId, status: 'processing' })
      }
      return new Response('not found', { status: 404 })
    })
    const mgmt = new ModusManagement({ apiKey: TEST_KEY, baseUrl: BASE, maxRetries: 0, fetch })
    const result = await mgmt.context.files.uploadDir(dir)
    expect(result.uploaded).toHaveLength(1)
    expect(result.failed).toEqual([{ path: join(dir, 'bad.exe'), error: 'File type not allowed' }])
  })
})
