/**
 * Skill toolset wire object: a map keyed by tool/integration surface
 * (e.g. `slack`, `clickup`, `sql_runner`, `memory`, `pipedream`, `custom_mcps`),
 * each with its own shape. Intentionally untyped: the OpenAPI `ToolsetDto`
 * schema (`{ tools: [{ id, enabled, config }] }`) is Swagger-only decoration —
 * the API's actual validator (`sanitizeAgentToolsetForWrite`) accepts this
 * keyed-map shape instead, and rejects real payloads against `ToolsetDto`.
 * Tightening this type here would misrepresent the real contract.
 */
export type ToolsetInput = Record<string, unknown>
