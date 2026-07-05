const EVERYONE_GROUP_ID = '__everyone__'

export function accessConfigWireForCreate(guardrails: string[]): Record<string, unknown> {
  return {
    visibility: 'shared',
    groupPermissions: { [EVERYONE_GROUP_ID]: { use: true, manage: true } },
    guardrails,
    sharedWith: [],
  }
}

export function accessConfigWireForUpdate(
  existing: Record<string, unknown> | undefined,
  guardrails: string[],
): Record<string, unknown> {
  if (!existing || Object.keys(existing).length === 0) {
    return accessConfigWireForCreate(guardrails)
  }
  return { ...existing, guardrails }
}

export function accessFromSkillResponse(raw: Record<string, unknown>): Record<string, unknown> {
  const value = raw.accessConfig ?? raw.access_config
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function accessConfigBodyForCreate(
  guardrails?: string[],
): Record<string, unknown> | undefined {
  if (guardrails === undefined) return undefined
  return accessConfigWireForCreate(guardrails)
}

export async function accessConfigBodyForUpdate(
  guardrails: string[] | undefined,
  loadResource: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown> | undefined> {
  if (guardrails === undefined) return undefined
  const existing = accessFromSkillResponse(await loadResource())
  return accessConfigWireForUpdate(existing, guardrails)
}
