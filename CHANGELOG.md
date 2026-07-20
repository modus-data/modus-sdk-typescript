# Changelog

**Current npm release:** [`0.2.1`](https://www.npmjs.com/package/@getmodus/sdk/v/0.2.1).


## [Unreleased]

### Fixed

- `chatStream` posts to agent-host `/agent/v1/.../runs` (parity with Python), not `/api/v1/.../chat/stream`.
- Streaming always sends `sessionId`; optional `organizationId` / `MODUS_ORGANIZATION_ID`.
- Default API/agent hosts are `*.getmodus.com`.
- `invokeOperation` supports **PUT** (unblocks `supervision.set` / `evaluations.updateConfig`).
- Agent-service calls honor `agentHost` / `MODUS_AGENT_HOST` over codegen `serverUrl`.
- `suggestions.recordEvent` accepts camelCase aliases and sends snake_case wire keys.
- `runs.create` / `createModus` / `createScope` / `resume` return a sync async-iterable stream (not a Promise wrapper).

### Added

- Runtime `AgentType.task` / `AgentType.workflow` (not type-only).
- Create responses expose `.uid` as an alias of `contextItemId`.
- Staging smoke includes buffered chat + streaming as a hard gate.

## [0.2.1] — 2026-07-20

### Changed

- Public README brought to parity with the Python SDK guide (product framing, auth, Modus vs scopes, chat/stream/context, management, pagination, errors).
- Added `assets/modus-logo.png` / `.svg` for GitHub mirror and package docs.

## [0.2.0] — 2026-07-20

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
