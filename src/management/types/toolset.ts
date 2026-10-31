/**
 * Skill toolset wire object: a map keyed by tool/integration surface
 * (e.g. `slack`, `clickup`, `sql_runner`, `memory`, `pipedream`, `custom_mcps`),
 * each with its own shape. Matches the published open-map schema. Unknown keys
 * are rejected on write.
 */
export type ToolsetInput = Record<string, unknown>
