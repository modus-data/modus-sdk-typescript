# Changelog

**Current npm release:** [`0.1.0`](https://www.npmjs.com/package/@getmodus/sdk) (2026-07-20) — first npm publish of `@getmodus/sdk`.

Next aligned cut: **`0.2.0`** (production-ready surface matching live public API).

## [Unreleased]

Content below ships as **`0.2.0`**.

### Added

- Canonical **`client.scopes` / `client.workflows`** and **`mgmt.scopes` / `mgmt.workflows`** against `/api/v1/scopes` and `/api/v1/workflows`.
- **`client.suggestions`** — `list()` / `recordEvent()`.
- **`client.workflows.runs.active()` / `activeBySession(...)`** — active conversation runs.
- **`mgmt.scopes.evaluations(scopeId)`** — evaluation config, trigger, run history.
- Bounded conversation windows via optional `{ messageLimit, beforeMessageIndex }` on `conversations(id).get()`.
- MCP **`get_context_data`** batch + ACL: `{ items[], sessionId? }` → `{ results[] }` (max 20).
- Shipped examples under `examples/scripts/`.
- Full public OpenAPI operation coverage (contract-tested). Dual ESM + CJS. Zero runtime dependencies.

### Changed

- Package name is **`@getmodus/sdk`** (npm org `getmodus`). Install: `npm install @getmodus/sdk`.
- Run creation: `client.workflows.runs.createScope(scopeId, body)` (not `createSkill`).
- Public docs use **Scope** / **Workflow** vocabulary.

### Removed

- Legacy **`client.skills` / `client.agents`** and **`mgmt.skills` / `mgmt.agents`** accessors — use `scopes` / `workflows`.

## [0.1.0] — 2026-07-20

### Added

- First public npm release of **`@getmodus/sdk`** (Node.js 18+): `Modus` + `ModusManagement`, pagination, retries, SSE chat, OpenAPI contract coverage.
