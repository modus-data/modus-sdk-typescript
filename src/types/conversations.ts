import type { components } from '../_generated/v1.js'

export type Conversation = components['schemas']['ConversationDto']
export type ConversationListItem = components['schemas']['ConversationListItemDto']
export type Message = components['schemas']['ConversationMessageDto']
export type ConversationKind = 'all' | 'modus' | 'scopes'

/** Scope id for a list item, or undefined for direct Modus chats (scopeId 0). */
export function conversationScopeId(item: ConversationListItem): number | undefined {
  return item.scopeId === 0 ? undefined : item.scopeId
}

/**
 * @deprecated Use `conversationScopeId` instead.
 * Preserves the legacy `0` sentinel for direct Modus chats (unlike
 * `conversationScopeId`, which returns `undefined` for id `0`).
 */
export function conversationSkillId(item: ConversationListItem): number | undefined {
  return item.scopeId
}
