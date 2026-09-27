import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { ContextItem, ContextItemAncestor, ContextItemLookupRow } from '../src/types/context.js'

const spec = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../src/_generated/public-openapi.json'),
    'utf8',
  ),
) as {
  components?: {
    schemas?: Record<string, { required?: string[]; properties?: Record<string, { nullable?: boolean }> }>
  }
}

const REQUIRED_ITEM = {
  uid: '7a3f9d2c-1111-4000-a000-000000000abc',
  orgId: 'org-uuid-abc',
  contextType: 'note',
  content: { title: 'Q3 notes' },
  userFeedback: 'neutral' as const,
  topics: [],
  dataPath: ['custom', 'note-1'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const RICH_ANCESTRY: ContextItemAncestor[] = [
  { uid: 'seg-a', display_name: 'A', type: 'container' },
  { uid: 'seg-b', display_name: 'B', type: null },
]

describe('optional ancestry on context item types', () => {
  it('allows omitted, null, empty, and rich ancestry on ContextItem', () => {
    const omitted: ContextItem = REQUIRED_ITEM
    expect(omitted.ancestry).toBeUndefined()

    const sqlNull: ContextItem = { ...REQUIRED_ITEM, ancestry: null }
    expect(sqlNull.ancestry).toBeNull()

    const empty: ContextItem = { ...REQUIRED_ITEM, ancestry: [] }
    expect(empty.ancestry).toEqual([])

    const rich: ContextItem = { ...REQUIRED_ITEM, ancestry: RICH_ANCESTRY }
    expect(rich.ancestry).toEqual(RICH_ANCESTRY)
    expect(rich.ancestry?.[0]?.display_name).toBe('A')
    expect('displayName' in (rich.ancestry?.[0] ?? {})).toBe(false)
  })

  it('keeps ancestry optional on generated public OpenAPI schemas', () => {
    const item = spec.components?.schemas?.ContextItemDto
    const lookup = spec.components?.schemas?.LookupContextItemRowDto
    expect(item?.required ?? []).not.toContain('ancestry')
    expect(lookup?.required ?? []).not.toContain('ancestry')
    expect(item?.properties?.ancestry?.nullable).toBe(true)
    expect(lookup?.properties?.ancestry?.nullable).toBe(true)
  })

  it('allows omitted ancestry on lookup rows', () => {
    const omitted: ContextItemLookupRow = {
      uid: 'note-1',
      contextType: 'note',
      dataPath: ['custom', 'note-1'],
      content: { title: 'Q3 notes' },
      connectionId: null,
      selectionId: null,
    }
    expect(omitted.ancestry).toBeUndefined()

    const rich: ContextItemLookupRow = { ...omitted, ancestry: RICH_ANCESTRY }
    expect(rich.ancestry?.[0]?.display_name).toBe('A')
  })
})
