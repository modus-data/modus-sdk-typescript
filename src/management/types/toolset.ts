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

/**
 * Integration grants keyed by the explicit, lowercase UUID of a shared connection.
 * A save that adds a personal connection's UUID here, or adds actions to one stored here, is refused
 * with 422; grant those with `personal`. A stored entry sent back unchanged still saves.
 */
export interface PlatformToolsetEntry {
  byConnection: Record<string, ToolsetSlot>
  /**
   * Actions granted on the personal connection of whoever runs the skill; absent grants none.
   * A runner who has not connected the platform is asked to connect it (a tool error outside chat);
   * nobody else's connection is used. Only platforms people connect personally, such as Gmail or Google Drive.
   */
  personal?: ToolsetSlot
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
 *   gmail: { byConnection: {}, personal: { actions: ['search-threads'] } } satisfies PlatformToolsetEntry,
 *   memory: { enabled: true },
 * }
 * ```
 */
export type ToolsetInput = Record<string, unknown>
