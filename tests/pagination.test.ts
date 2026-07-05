import { describe, expect, it } from 'vitest'
import {
  Page,
  aipListParams,
  buildAipPage,
  normalizePageToken,
} from '../src/_pagination.js'
import { ModusError } from '../src/_exceptions.js'

function makePage<T>(
  items: T[],
  nextPageToken?: string,
  pages?: Array<[T[], string | undefined]>,
): Page<T> {
  let idx = 0
  const fetchPage = (_token: string): Page<T> => {
    if (pages && idx < pages.length) {
      const [newItems, newCursor] = pages[idx]!
      idx += 1
      return makePage(newItems, newCursor, pages.slice(idx))
    }
    throw new Error('Unexpected page fetch')
  }
  return new Page(items, nextPageToken, fetchPage)
}

describe('Page', () => {
  it('iterates current page only', () => {
    expect([...makePage([1, 2, 3])]).toEqual([1, 2, 3])
  })

  it('hasNextPage', () => {
    expect(makePage([1], 'cur_abc').hasNextPage()).toBe(true)
    expect(makePage([1]).hasNextPage()).toBe(false)
  })

  it('getNextPage', async () => {
    const next = makePage([4, 5])
    const page = new Page([1, 2, 3], 'cur', () => next)
    expect([...(await page.getNextPage())]).toEqual([4, 5])
  })

  it('getNextPage throws when no next', async () => {
    await expect(makePage([1]).getNextPage()).rejects.toThrow(/No next page/)
  })

  it('autoPagingIter single page', async () => {
    const items: number[] = []
    for await (const item of makePage([1, 2, 3]).autoPagingIter()) items.push(item)
    expect(items).toEqual([1, 2, 3])
  })

  it('autoPagingIter multiple pages', async () => {
    const page2 = makePage([3, 4])
    const page1 = new Page([1, 2], 'c1', () => page2)
    const items: number[] = []
    for await (const item of page1.autoPagingIter()) items.push(item)
    expect(items).toEqual([1, 2, 3, 4])
  })
})

describe('pagination helpers', () => {
  it('normalizePageToken', () => {
    expect(normalizePageToken(undefined)).toBeUndefined()
    expect(normalizePageToken('')).toBeUndefined()
    expect(normalizePageToken('  ')).toBeUndefined()
    expect(normalizePageToken('abc')).toBe('abc')
  })

  it('aipListParams', () => {
    expect(aipListParams(25)).toEqual({ pageSize: 25 })
    expect(aipListParams(25, 'tok', { q: 'x' })).toEqual({
      pageSize: 25,
      q: 'x',
      pageToken: 'tok',
    })
  })

  it('buildAipPage validates shape', () => {
    expect(() => buildAipPage({ error: 'x' }, 'skills', (x) => x, () => makePage([]))).toThrow(
      ModusError,
    )
    expect(() =>
      buildAipPage({ skills: { id: 1 } }, 'skills', (x) => x, () => makePage([])),
    ).toThrow(/must be a list/)
    const page = buildAipPage({ skills: [], nextPageToken: null }, 'skills', (x) => x, () =>
      makePage([]),
    )
    expect(page.items).toEqual([])
  })
})
