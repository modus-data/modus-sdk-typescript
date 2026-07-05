export function updateMaskQuery(
  updateMask?: string,
): Record<string, string> | undefined {
  if (updateMask === undefined) return undefined
  if (!updateMask.trim()) {
    throw new Error('update_mask must be a non-empty comma-separated list of field names')
  }
  return { updateMask }
}
