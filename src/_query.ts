import { ValidationError } from './_exceptions.js'

export function updateMaskQuery(
  updateMask?: string,
): Record<string, string> | undefined {
  if (updateMask === undefined) return undefined
  if (!updateMask.trim()) {
    throw new ValidationError('update_mask must be a non-empty comma-separated list of field names')
  }
  return { updateMask }
}

/**
 * A PATCH body: the fields the caller set, plus `null` for each masked field left unset.
 *
 * The server writes only fields that are both in the mask and present in the body, so a masked
 * field left unset must go on the wire as `null` to be cleared. A nested mask path
 * (`accessConfig.visibility`) never nulls its root object.
 */
export function updateBody(fields: object, updateMask?: string): Record<string, unknown> {
  const body: Record<string, unknown> = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  )
  for (const field of updateMask?.split(',') ?? []) {
    const name = field.trim()
    if (name && !name.includes('.') && !(name in body)) body[name] = null
  }
  return body
}
