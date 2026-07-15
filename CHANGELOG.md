# Changelog

**Current npm release:** not yet published. Pre-release via `@beta` dist-tag when available.

## [Unreleased]

### Changed (BREAKING)

- **MCP `get_context_data` batch + ACL (BREAKING)** — Renamed from `fetch_context_file`. Pass `{ items[], sessionId? }` instead of top-level `itemId`. Response `{ results[] }` with per-item `ok` / errors (max 20). ACL + scope surface authorization; optional `sessionId` for Mongo offload cache.
- **`/scopes` + `/workflows` are now the only public surface.** `client.scopes` / `client.workflows` and `mgmt.scopes` / `mgmt.workflows` are canonical; they call the `/api/v1/scopes` and `/api/v1/workflows` routes and the `ScopesController_*` / `WorkflowsController_*` operationIds.
- Run creation: `client.workflows.runs.createScope(scopeId, body)` replaces the old `createSkill(...)` (routes to `/agent/v1/scopes/:id/runs`).
- Existing tokens that carry the legacy `skills:*` / `agents:*` scopes continue to authorize the renamed routes via server-side scope equivalence — no token re-issuance is required.

### Removed (BREAKING)

- **`client.skills` / `client.agents`** and **`mgmt.skills` / `mgmt.agents`** accessors — use `client.scopes` / `client.workflows` and `mgmt.scopes` / `mgmt.workflows`. The legacy `/api/v1/skills` and `/api/v1/agents` routes (and their `SkillsController_*` / `AgentsController_*` operationIds) no longer exist.
- Placeholder `SECURITY.md` (no verified security contact yet).

### Added

- Shipped examples under `examples/scripts/` (`quickstart`, `modus_chat`, `chat`, `manage_skill`) with revenue / ARR analyst prompts.
- `skills.conversations(id).get()` accepts an optional `{ messageLimit, beforeMessageIndex }` to request a bounded message window; the response gains an optional `messageWindow` field describing the returned slice. Omit both for the full conversation (unchanged default behavior).
- **`client.suggestions`** — `list()` returns approved suggested questions (optional `skillId`/`skillIds` filter), `recordEvent()` records an impression/click/dismiss event against a suggestion.
- **`client.workflows.runs.active(options)` / `activeBySession(sessionIds)`** — list active (queued/pending/running) conversation runs for the current user, or look up active runs for specific conversation thread ids.
- **`claude-sonnet-4.6`** restored as an allowed run `model` value (scope/workflow run creation and chat).
- **`mgmt.scopes.evaluations(scopeId)`** — `getConfig()` / `updateConfig()` manage a scope's evaluation schedule and judge settings; `triggerRun()` starts a manual evaluation run; `listRuns()` / `getRun(runId)` read run history and per-case results.

### Fixed

- Typed run event streams now recover from interrupted model providers and emit `assistant_content_reset` when previously streamed assistant content is replaced.

## [0.1.0] — 2026-06-21

### Added

- **`@modus/sdk`** — official TypeScript client for Modus (Node.js 18+).
- **`Modus`** client — read / invoke: skills, agents, context, connections, Modus assistant chat, runs.
- **`ModusManagement`** (`@modus/sdk/management`) — configure: CRUD, deploy, context creators, usage, org admin.
- Cursor-based **`Page<T>`** pagination with `autoPagingIter()` (AIP-158 `pageSize` / `pageToken`).
- Automatic retry on 429 and 5xx with exponential backoff and `Retry-After` support.
- SSE streaming chat via `ChatStream` (`textStream()`, `eventStream()`).
- **58/58** public API operations covered; contract tests enforce OpenAPI parity.
- Dual **ESM + CommonJS** build (`import` and `require()`).
- Zero runtime dependencies.
