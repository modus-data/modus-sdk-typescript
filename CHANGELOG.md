# Changelog

**Current npm release:** [`0.2.3`](https://www.npmjs.com/package/@getmodus/sdk/v/0.2.3).



## [Unreleased]

> **Breaking removals below ship in the next major SDK release** (not a `0.2.x`
> patch). See `distribution/docs/COMPATIBILITY.md`.

### Deprecated

- **`Skill` / `Agent` type names** — use `Scope` / `Workflow` (OpenAPI `ScopeDto` / `WorkflowDto`).
- **`CreateSkillOptions` / `UpdateSkillOptions`** — use `CreateScopeOptions` / `UpdateScopeOptions`.
- **`CreateAgentOptions` / `UpdateAgentOptions`** — use `CreateWorkflowOptions` / `UpdateWorkflowOptions`.
- **`conversationSkillId()`** — use `conversationScopeId()`.

### Changed

- SDK read types are exported as `Scope` / `Workflow` backed by generated `ScopeDto` / `WorkflowDto`.
- Custom context create responses always expose `.uid` (same value as `contextItemId`).

### Removed

- Dual list/deploy envelopes — responses use `scopes` / `workflows` and `scope` / `workflow` only (no `skills` / `agents` / `skill` / `agent` aliases).
- OpenAPI public schema aliases **`SkillDto` / `AgentDto`** — use `ScopeDto` / `WorkflowDto`.
- Conversation `kind=skills` — use `kind=scopes`.
- `mgmt.organization.delete()` — organization deletion is no longer part of the
  public API / PAT surface (SPA-only).
- `GET /api/v1/users/member-groups` and `/org-members` no longer advertise `pageSize` /
  `pageToken` query params or an always-`null` `nextPageToken` response field (OpenAPI /
  Management MCP surface — `mgmt.users.listMemberGroups()` / `listOrgMembers()` never
  exposed either). Both endpoints return the full org-bounded roster; pagination was never
  honored server-side.

## [0.2.3] — 2026-07-20

### Fixed

- Streaming requests send `Accept: text/event-stream`; a non-SSE response (e.g. JSON polling body) raises `ModusError` instead of returning an empty stream.
- `createModus` / `createScope` / `runs.create()` / `resume()` always mint (or reuse) a `sessionId`.

## [0.2.2] — 2026-07-20

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
