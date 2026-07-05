import { ModusError } from './_exceptions.js'

export class Page<T> {
  readonly items: T[]
  readonly nextPageToken?: string
  private readonly fetchPage: (token: string) => Page<T> | Promise<Page<T>>

  constructor(
    items: T[],
    nextPageToken: string | undefined,
    fetchPage: (token: string) => Page<T> | Promise<Page<T>>,
  ) {
    this.items = items
    this.nextPageToken = normalizePageToken(nextPageToken)
    this.fetchPage = fetchPage
  }

  hasNextPage(): boolean {
    return this.nextPageToken !== undefined
  }

  async getNextPage(): Promise<Page<T>> {
    if (this.nextPageToken === undefined) {
      throw new Error(
        'No next page available. Check hasNextPage() before calling getNextPage().',
      )
    }
    return this.fetchPage(this.nextPageToken)
  }

  async *autoPagingIter(): AsyncGenerator<T> {
    for (const item of this.items) yield item
    let nextPageToken = this.nextPageToken
    while (nextPageToken !== undefined) {
      const page = await this.fetchPage(nextPageToken)
      for (const item of page.items) yield item
      nextPageToken = page.nextPageToken
    }
  }

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]()
  }
}

export function normalizePageToken(token?: string | null): string | undefined {
  if (token === undefined || token === null || !String(token).trim()) return undefined
  return token
}

export function aipListParams(
  pageSize: number,
  pageToken?: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const params: Record<string, unknown> = { pageSize, ...extra }
  const token = normalizePageToken(pageToken)
  if (token !== undefined) params.pageToken = token
  return params
}

export function nextPageTokenFromResponse(data: Record<string, unknown>): string | undefined {
  return normalizePageToken(
    typeof data.nextPageToken === 'string' ? data.nextPageToken : undefined,
  )
}

export function requireItemsList(data: Record<string, unknown>, itemsKey: string): unknown[] {
  const value = data[itemsKey]
  if (!Array.isArray(value)) {
    throw new ModusError(
      `Unexpected list response shape: ${itemsKey} must be a list, got ${typeof value}. This is likely a backend error.`,
    )
  }
  return value
}

export function buildAipPage<T>(
  data: Record<string, unknown>,
  itemsKey: string,
  mapItem: (raw: unknown) => T,
  fetchPage: (token: string) => Page<T> | Promise<Page<T>>,
): Page<T> {
  if (typeof data !== 'object' || data === null || !(itemsKey in data)) {
    throw new ModusError(
      `Unexpected list response shape: missing ${itemsKey}. Got: ${typeof data}. This is likely a backend error.`,
    )
  }
  const items = requireItemsList(data, itemsKey).map(mapItem)
  return new Page(items, nextPageTokenFromResponse(data), fetchPage)
}
