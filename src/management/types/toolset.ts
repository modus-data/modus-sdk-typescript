/** Channel restrictions for one integration connection's actions. */
export interface ToolsetRules {
  allowedChannelIds?: string[]
  allowedChannelNames?: Record<string, string>
}

/** Operation names granted on one connection, without path or project suffixes. */
export interface ToolsetSlot {
  actions: string[]
  rules?: ToolsetRules
}

/** Integration grants keyed by the explicit, lowercase connection UUID. */
export interface PlatformToolsetEntry {
  byConnection: Record<string, ToolsetSlot>
}

/**
 * Skill toolset wire object, keyed by catalog platform or nonintegration tool name.
 * Integration values use `PlatformToolsetEntry`; SQL platforms grant `query`.
 * General tools, MCP, Pipedream and Coding retain their own formats.
 * The API validates known keys and values; this matches its open-map schema.
 *
 * @example
 * ```ts
 * const toolset: ToolsetInput = {
 *   postgresql: {
 *     byConnection: {
 *       '11111111-1111-4111-8111-111111111111': { actions: ['query'] },
 *     },
 *   } satisfies PlatformToolsetEntry,
 *   memory: { enabled: true },
 * }
 * ```
 */
export type ToolsetInput = Record<string, unknown>
