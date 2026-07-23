import type { components } from '../_generated/v1.js'

export type ContextItem = components['schemas']['ContextItemDto']
export type ContextItemLookupRow = components['schemas']['LookupContextItemRowDto']
export type ContextItemDeletion = components['schemas']['DeleteContextItemResponseDto']
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
