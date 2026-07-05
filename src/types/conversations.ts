import type { components } from '../_generated/v1.js'

export type Conversation = components['schemas']['ConversationDto']
export type ConversationListItem = components['schemas']['ConversationListItemDto']
export type Message = components['schemas']['ConversationMessageDto']
export type ConversationKind = 'all' | 'modus' | 'skills'

/** Skill id for a list item, or undefined for direct Modus chats (skillId 0). */
export function conversationSkillId(item: ConversationListItem): number | undefined {
  return item.skillId === 0 ? undefined : item.skillId
}
