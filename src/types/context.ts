import type { components } from '../_generated/v1.js'

export type ContextItem = components['schemas']['ContextItemDto']
export type ContextItemAncestor = components['schemas']['ContextItemAncestorDto']
export type ContextItemLookupRow = components['schemas']['LookupContextItemRowDto']
export type ContextItemDeletion = components['schemas']['DeleteContextItemResponseDto']
export type ContextItemMove = components['schemas']['MoveContextItemResponseDto']
/** Input for `updateAccess()`; all three settings replace the current ones. */
export type UpdateContextItemAccessInput = components['schemas']['UpdateContextItemAccessDto']
/** Who can view and manage an item after `updateAccess()`. */
export type ContextItemAccessUpdate = components['schemas']['ContextItemAccessResponseDto']
/** Create response; ``uid`` mirrors ``contextItemId`` for list/get parity. */
export type CreatedContextItem = components['schemas']['CreatedContextItemResponseDto'] & {
  uid: string
}
export type ContextType = string

export function withCreatedUid(
  data: components['schemas']['CreatedContextItemResponseDto'],
): CreatedContextItem {
  return { ...data, uid: data.contextItemId }
}
