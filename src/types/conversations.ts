import type { components } from '../_generated/v1.js'

export type Conversation = components['schemas']['ConversationDto']
export type ConversationListItem = components['schemas']['ConversationListItemDto']
export type Message = components['schemas']['ConversationMessageDto']
/** `scopes` is canonical; `skills` is the deprecated alias (same filter). */
export type ConversationKind = 'all' | 'modus' | 'scopes' | 'skills'

/** Scope id for a list item, or undefined for direct Modus chats (scopeId/skillId 0). */
export function conversationScopeId(item: ConversationListItem): number | undefined {
  const id = item.scopeId ?? item.skillId
  return id === 0 ? undefined : id
}

/** @deprecated Use `conversationScopeId` instead. */
export function conversationSkillId(item: ConversationListItem): number | undefined {
  return conversationScopeId(item)
}
