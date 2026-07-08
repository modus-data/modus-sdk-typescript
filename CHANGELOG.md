# Changelog

**Current npm release:** not yet published. Pre-release via `@beta` dist-tag when available.

## [Unreleased]

### Changed (BREAKING)

- **MCP `get_context_data` (BREAKING)** — Renamed from `get_context_file` (and earlier `fetch_context_file`, `get_context_item`, `fetch_item`). Pass `{ sessionId, itemId, field? }` instead of `{ sessionId, path }`; `contextFiles[]` uses `itemId` + optional `field` (no internal paths). Error codes: `ITEM_NOT_ALLOWED`, `AMBIGUOUS_ITEM`.
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
