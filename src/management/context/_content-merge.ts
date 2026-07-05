import type { ContextItem } from '../../types/context.js'
import type { ManagementContextItemsResource } from './items.js'

export type UserFeedback = 'positive' | 'neutral' | 'negative'

function requireContentDict(item: ContextItem, contextType: string): Record<string, unknown> {
  if (item.contextType !== contextType) {
    throw new Error(`Expected contextType ${contextType}, got ${item.contextType}.`)
  }
  if (!item.content || typeof item.content !== 'object' || Array.isArray(item.content)) {
    throw new Error(`Context item ${item.uid} has no object content; cannot merge ${contextType} fields.`)
  }
  return item.content as Record<string, unknown>
}

export function mergeNoteContent(
  existing: Record<string, unknown>,
  options: { title: string; body: string },
): Record<string, unknown> {
  return { ...existing, title: options.title, content: options.body }
}

export function mergeLinkContent(
  existing: Record<string, unknown>,
  options: { title?: string; url?: string },
): Record<string, unknown> {
  const merged = { ...existing }
  if (options.title !== undefined) merged.title = options.title
  if (options.url !== undefined) merged.url = options.url
  return merged
}

export function mergeSavedQueryContent(
  existing: Record<string, unknown>,
  options: {
    name: string
    query: string
    connectionId?: string
    path?: string[]
  },
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing, name: options.name, query: options.query }
  if (options.connectionId !== undefined) merged.connectionId = options.connectionId
  if (options.path !== undefined) merged.path = options.path
  return merged
}

async function resolveExistingContent(
  items: ManagementContextItemsResource,
  uid: string,
  contextType: string,
  existing?: ContextItem,
): Promise<Record<string, unknown>> {
  const item = existing ?? (await items.get(uid))
  return requireContentDict(item, contextType)
}

export async function updateWithMergedContent(
  items: ManagementContextItemsResource,
  uid: string,
  options: {
    contextType: string
    mergedContent: Record<string, unknown>
    existing?: ContextItem
    description?: string
    userFeedback?: UserFeedback
    topics?: string[]
  },
): Promise<ContextItem> {
  if (options.existing) requireContentDict(options.existing, options.contextType)
  return items.update(uid, {
    contextType: options.contextType,
    content: options.mergedContent,
    description: options.description,
    userFeedback: options.userFeedback,
    topics: options.topics,
  })
}

export async function resolveAndUpdateNote(
  items: ManagementContextItemsResource,
  uid: string,
  options: {
    title: string
    body: string
    existing?: ContextItem
    description?: string
    userFeedback?: UserFeedback
    topics?: string[]
  },
): Promise<ContextItem> {
  const content = await resolveExistingContent(items, uid, 'note', options.existing)
  return updateWithMergedContent(items, uid, {
    contextType: 'note',
    mergedContent: mergeNoteContent(content, { title: options.title, body: options.body }),
    existing: options.existing,
    description: options.description,
    userFeedback: options.userFeedback,
    topics: options.topics,
  })
}

export async function resolveAndUpdateSavedQuery(
  items: ManagementContextItemsResource,
  uid: string,
  options: {
    name: string
    query: string
    connectionId?: string
    path?: string[]
    existing?: ContextItem
    description?: string
    userFeedback?: UserFeedback
    topics?: string[]
  },
): Promise<ContextItem> {
  const content = await resolveExistingContent(items, uid, 'saved_query', options.existing)
  return updateWithMergedContent(items, uid, {
    contextType: 'saved_query',
    mergedContent: mergeSavedQueryContent(content, options),
    existing: options.existing,
    description: options.description,
    userFeedback: options.userFeedback,
    topics: options.topics,
  })
}

export async function resolveAndUpdateLink(
  items: ManagementContextItemsResource,
  uid: string,
  options: {
    title?: string
    url?: string
    existing?: ContextItem
    description?: string
    userFeedback?: UserFeedback
    topics?: string[]
  },
): Promise<ContextItem> {
  if (
    options.title === undefined &&
    options.url === undefined &&
    options.description === undefined &&
    options.userFeedback === undefined &&
    options.topics === undefined
  ) {
    throw new Error('Provide at least one field to update.')
  }
  if (options.title === undefined && options.url === undefined) {
    return items.update(uid, {
      description: options.description,
      userFeedback: options.userFeedback,
      topics: options.topics,
    })
  }
  const content = await resolveExistingContent(items, uid, 'link', options.existing)
  return updateWithMergedContent(items, uid, {
    contextType: 'link',
    mergedContent: mergeLinkContent(content, { title: options.title, url: options.url }),
    existing: options.existing,
    description: options.description,
    userFeedback: options.userFeedback,
    topics: options.topics,
  })
}
