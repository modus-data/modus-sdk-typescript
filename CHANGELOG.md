# Changelog

Published versions come from the `sdk-typescript/v*` tags; the current release is
whatever [npm](https://www.npmjs.com/package/@getmodus/sdk) is serving. This file
records what changed, not which version is live.

Record concise, customer-visible release notes under `[Unreleased]` for every SDK
release, including pre-1.0 (`0.x`) releases.

## [Unreleased]

### Added

- **`deepseek-v4.1-flash-1017` model.** The October 17, 2026 snapshot of DeepSeek V4.1 Flash is an
  accepted chat model id.
- **`BadRequestError`** for HTTP 400 (a schema or parse failure), a `ModusError` subclass, so
  existing `catch (e instanceof ModusError)` code is unaffected.
- **`ModusError.info`** carries the error envelope's structured detail, for example
  `info.missing` (the token scopes a 403 lacks) or `info.violations` on a 422.
- **`ModusError.retryable`** says whether the SDK's retry rule allowed re-sending the failed call.
- **`Retry-After` as an HTTP date, and `retry-after-ms`,** fill `RateLimitError.retryAfter`.
- **An organization owner can give an ownerless scope an owner.** A scope created with a service-account token has no owner. `scopes.requestOwnershipTransfer(id, { newOwnerUserId })` by an organization owner now assigns one: naming yourself takes effect at once, naming another member waits for them to accept. `scopes.cancelOwnershipTransfer(id)` lets the organization owner withdraw that request.

### Changed

- **Evaluation types are now accurate (were `Record<string, never>`).** `EvaluationRun` `finishedAt` and `avgScore`, and the result fields `actualOutput`, `passed`, `score`, `reasoning` and `wasPassingBefore`, are `string | null`, `number | null` or `boolean | null`, so they no longer need a cast. An evaluation recipient's `name` is `string | null`, and `slackUserIdByRecipient` is a string-keyed map. `startedAt` and `finishedAt` are ISO 8601 strings (the server sent a JavaScript date string before).
- **Run request types document the API-token rules.** `message` notes the 32,000-character limit the server holds API tokens to, and `config.model` lists the models an API token may send.
- **Breaking (pre-1.0): scope `connectionSet` rows have one shape.** `scopes.create` and `scopes.update` accept each entry only as `{ connection_id, path, preferences?, context_enabled? }`, where `path` is an array of strings, `preferences` an object and `context_enabled` a boolean. An empty path selects the whole connection. Any other field, a non-string path segment, an empty or null `connection_id`, or a null `connectionSet` is rejected with 400. `variation.connectionSet` is now `{ connection_id: string; path: string[]; preferences?: Record<string, unknown>; context_enabled?: boolean }` instead of `Record<string, unknown>[]`.
- **Breaking (pre-1.0): workflow `guardrails` removed.** `workflows.create` and `workflows.update` no longer take `guardrails`. The workflow access configuration has no guardrails, so every call that set it failed with 400 and changed nothing. Scope `guardrails` are unchanged.
- **Breaking (pre-1.0): `scopes.memories(id).update()` returns `Promise<void>`.** The server answers 204 with no body; the method returned `null` typed as `Memory`.
- **Breaking (pre-1.0): `managerId` is `number | null`.** `scopes.update({ managerId })` takes the numeric id of the manager scope, or `null` to detach. It was typed `string`, which the server rejects with 400.
- **Breaking (pre-1.0): evaluation runs `pageSize` is checked.** `scopes.evaluations(id).listRuns()` rejects a `pageSize` outside 1..100 with 400, like every other list (it was clamped above 100).
- **Breaking (pre-1.0): a POST that fails after being sent now throws instead of being
  re-sent.** Retries depend on the method: GET, PUT, PATCH and DELETE retry 408, 429, 500, 502,
  503, 504, dropped connections and timeouts. A POST retries only on 429 or a connection that
  never opened, except the POSTs that only read or set a state (context compose, item lookup, memory search, active-run lookup, run cancel, run interrupt, workflow-action cancel, workflow toggle, ingested-data upload), which retry like
  a GET. Before, a `scopes.create` that hit a gateway 502 or a timeout was sent again and could
  create a second scope; now it throws and you decide whether to re-create.
- **A `Retry-After` over 60 s throws `RateLimitError` at once** (with `retryAfter` set)
  instead of sleeping that long. Up to 60 s is still waited out.
- **Reading a workflow needs use or manage permission, not manage alone.** `workflows.get(id)` returns a workflow you can run or change; `canUse` and `canManage` say which. A workflow you cannot access is a 404 `NotFoundError` instead of a 403. `workflows.interfaces(id).list()` still needs manage permission (403), and is a 404 when you cannot access the workflow.
- **Deploying a scheduled workflow with no owner is a 409.** `workflows.deploy(id)` no longer reports an ownerless scheduled workflow as enabled when no schedule could be created.
- **A non-UUID interface id is a 400.** `workflows.interfaces(id).update()` and `.delete()` with an id that is not a UUID return 400 instead of a retried 500.
- **Dashboard and element titles must contain a non-whitespace character.** A blank title on `context.dashboards.create`, `.updateDraft`, and `.elements(id).create` / `.update` returns 400.
- **Delete docs match the server.** Deleting a workflow or scope that is already deleted returns 404; deleting a memory that no longer exists returns 404 (it returned 422). Neither is a no-op.
- **Custom context item writes are documented as opt-in.** `customItems` writes
  reject with `PermissionDeniedError` ("Custom context item writes are not
  enabled") until Modus enables them for the organization.
- **Breaking (pre-1.0): `runs.interrupt` and `runs.editQueued` take the turn to send.** `runs.interrupt(runId, nextRun, { lastSeenEventId? })` and `runs.editQueued(runId, nextRun)` send `nextRun` (`message` and `sessionId`, the run's conversation id) and return the admitted run as `RunAdmission` (`{ runId, status }`). For `interrupt`, that is the new run that carries the follow-up turn; stream it with `runs.stream(runId)`. The old signatures sent an empty body, which the server always rejected, so no working call changes behaviour. `interrupt` sets `nextRun.runId` when you omit it, so a retried request returns the same run instead of starting a second turn. On a run that has already finished, `interrupt` starts a follow-up turn.
- **`runs.resume` sends no message.** The documented example now sends only `decision` and `sessionId`; a non-empty `message` is rejected by the server. A blank `sessionId` is refused before any request instead of being replaced by a new random conversation.

### Fixed

- **A path id of `'..'` could target the parent resource, e.g. delete the scope.** `scopes.memories(7).delete('..')` sent `DELETE /scopes/7`. Every path id that is blank, `'.'` or `'..'` now raises `ValidationError` before any request; a blank id no longer returns the list page as one item.
- **Paging no longer skips items.** `scopes.list()`, `workflows.list()`, `connections.list()` and their auto-paging iterators return every item: a page boundary no longer drops items created in the same millisecond, and `connections.list()` no longer drops a connection or ends early when other members' connections are hidden from you.
- **Numeric ids above 2147483647 return 404.** Such a scope or workflow id now throws `NotFoundError` instead of a 500 that was retried three times.
- **Evaluation runs page in a stable order.** Runs that started at the same time are no longer repeated or skipped across pages.
- **`updateMask` clears the fields it names.** A field named in `updateMask` and left unset is sent as `null`, so the server clears it, on `scopes.update`, `workflows.update`, `context.items.update`, and both `interfaces(id).update`. Before, it was dropped from the body and nothing was cleared.
- **`suggestions.list({ scopeIds: [] })` throws `ValidationError`** before any request. It sent `scopeIds=`, which the server rejects with 400.
- **Docs: ids are numeric.** The getting-started example took a slug (`scopes.get('revenue-analysis')`), which the server rejects with 400; it now takes an id from `list()`. Docs no longer say "id or slug". `type: 'task'` is documented as a deprecated alias on create; `workflows.update` accepts only `workflow`.
- **`requestId` is set on every API error.** It was always `undefined`, because the API sends
  it in the error body, not in an `x-request-id` header. The header is still used when the body
  has none.
- **A 2xx response that is not JSON** throws a `ModusError` naming the status, content type and
  the first 200 characters, after one request. It was an `APIConnectionError` ("check
  connectivity") retried three times.
- **`UnprocessableError` documentation:** 422 is a business-rule failure; schema failures are
  400 (`BadRequestError`).
- **Breaking (pre-1.0): `context.items.listValues` pages one item's array.** The
  server used to ignore the uid and return one row per item of the context type,
  with each item's whole `content`. It now reads only the item named by `uid`
  (not found when it is missing, unreadable, or of another context type) and pages
  the elements of the array at `contentKeyPath`. `ContextValueRow` is
  `{ index, value }`: the element's 0-based position and the element itself.
- **Conversation messages carry text.** `conversations.get` returns `content` as a
  string for every message, as typed; tool calls stay in `toolCalls`.
- **Oversized request bodies say so.** A request body over an operation's size
  limit fails with HTTP 413 and error code `PAYLOAD_TOO_LARGE` instead of
  `BAD_REQUEST`. Dashboards, a custom context item and a note now accept up to
  1 MiB, and `customItems.batchCreate` up to 8 MiB.

## [0.9.0] — 2026-10-24

### Added

- **List selectable units.** `client.connections.listSelections(connectionId)` and
  `iterSelections(connectionId)` page the units a scope can select on a connection
  (`GET /connections/{id}/selections`). `client.connections.list()` items may include
  `selectionModel`.
- **Evaluation case methods.** `scopes.evaluations(id).addCase()`, `.updateCase(caseId)`, and `.deleteCase(caseId)` add, change, or remove one evaluation case. Omit `id` on add and the client assigns one, so a retry sends the same id. A retry whose id is already stored returns a conflict; an identical body is not treated as success. An empty `task` is allowed. An update with neither field is rejected.

### Changed

- **MCP config is checked on write.** `scopes.create`, `scopes.update`, and `PATCH /scopes/{id}/mcp-config` return the effective core tools and tool exposure. A changed value must use true or false for each core tool, and version 1 with mode subset or discovery for tool exposure. A newly added exposure key must be one the scope can expose. A key already stored can be sent again or removed.
- **Breaking (pre-1.0): typed evaluation cases.** `scopes.update` `evaluations` items are `{ id?, task, expectedOutput }`. `task` and `expectedOutput` are required, and any other key, such as `createdAt` or `updatedAt`, is rejected with 400. Omit `id` on a new case and one is assigned. A repeated `id` is rejected. An empty `task` is allowed.
- **Breaking (pre-1.0): scope `interfaces` have one shape.** `scopes.create` and `scopes.update` (`POST /api/v1/scopes` and `PATCH /api/v1/scopes/{id}`) accept only MCP interface rows. `type` must be `mcp`. Each row has an optional id and name and a config of core tools and exposed integrations. A row without an id or name is assigned one. Responses return only id, type, name, and config; extra stored keys such as `enabled` are no longer returned.
- **Workflow responses declare their shapes.** `Workflow` variation fields `trigger`, `workflowStructure`, and `agentSelection` are `WorkflowTriggerResponseDto`, `WorkflowStructureResponseDto`, and `AgentSelectionResponseDto` instead of open objects. A non-schedule trigger has `schedule: null`, and a schedule leaves unused cadence fields null. A workflow interface `config` describes Slack and Teams (`accessMode`, `allowedEmails`, `availableChannelIds`) and an empty object for MCP.
- **Scope create and update describe `connectionSet`.** An entry selects a whole connection (`path: []`) or one selectable unit of it, never anything below. Lists replace the stored list.
- **Scope `connectionSet` rows must be a selectable unit.** `scopes.create` and `scopes.update` reject a new row whose path is neither the whole connection nor one selectable unit of it, with 422 `root.not_a_root`. A row already stored can stay, and removing it still succeeds.
- **Workflow interface config.** Slack and Teams `config` on a workflow interface is `accessMode` (`all`, `allow-list`, or `allow-org`), `allowedEmails`, and `availableChannelIds`. An MCP interface accepts no config keys. An unknown key or invalid value in a changed config returns 422 with violations; `config: null` returns 400. Unchanged stored values are accepted.
- **`searchQuery` documents word search.** `context.customItems.list({ searchQuery })` (`GET /context/custom-items`) describes
  word search: it returns rows that contain every word of the query, case-insensitive.
- **Known toolset values are validated.** A new or edited scope `toolset` value must match that tool's shape.
  Most tools take an array of strings. `file_publish` takes `{ actions: string[], rules?: { nameMode: "any" | "restricted", allowedNames: string[] } }`.
  Coding tools take an array of `{ connectionUid, repoOwner, repoName, branch }`.
  `sql_runner` entries are `VERB:connectionId:`, optionally followed by `database:schema`, where `VERB` is `SELECT`, `INSERT`, `UPDATE`, `DELETE`, or `CREATE`.
  A value that does not match is `422`
  with rule `toolset.bad_value`; an unknown key stays `toolset.unknown_key`. Sending the same stored value again succeeds,
  including a historical value the new check would reject, and removing that value succeeds.

### Removed

- **Breaking: `ToolsetDto` and `ToolsetToolDto`.** Both are removed from `components["schemas"]`. Scope create and update `toolset` is a map of tool key to its configuration; type it with `ToolsetInput` from `@getmodus/sdk/management`. The generated `{ tools: [{ id, enabled, config }] }` models are gone. Unknown keys are rejected.
- **Breaking (pre-1.0): evaluation case timestamps.** Scope evaluation cases no longer include `createdAt` or `updatedAt`.

## [0.8.0] — 2026-10-18

### Removed

- **Breaking: evaluation Slack `nangoConnectionId`.** Send `connectionId`, the
  Slack connection's Modus UUID, in notification settings instead. The generated
  `EvaluationSlackChannelDto` type uses `connectionId`. No deprecation window;
  requires a major release.

### Added

- **`includeOwnLearnings` on `scopes.create`.** A new scope reads what is taught while
  using it by default; pass `false` to create it without its own learnings.
- **`defaultHeaders` client option.** `Modus` and `ModusManagement` accept headers to
  send on every request. They override the SDK's own defaults, except `Authorization`,
  which always comes from `apiKey`.
- **`X-Modus-Client: sdk` request header.** Every request names the SDK as the client.
- **`gpt-6-luna` model.** The chat request `model` union accepts the new
  OpenAI model.
- **`gpt-5.6-luna` model.** The chat request `model` union accepts the new
  OpenAI model.
- **Move Files items.** `mgmt.context.items.move(uid, { destinationFolderUid })`
  relocates a live file or folder. Pass `null` for the Files root.
- **Generic context item browse.** `client.context.items.list()` and
  `mgmt.context.items.list()` accept optional `connectionIds`, `parentUids`,
  and `ancestorUids` arrays. Omit a filter to leave it unrestricted; pass `[]`
  for the known-empty / match-none forms (`parentUids: []` is the Files root).
- **Upload destinations.** Upload helpers accept an optional `folderPath`
  prefix for single files, batches, and directories.

### Changed

- **Scope context file handling.** `scopes.getContext()` returns bounded inline
  previews for large bodies; full file content is not available through this REST method.
- **Connected-integration toolset entries bind to a connection.** A scope toolset entry
  given as `{ actions: [...], rules }` is bound on create/update to the organization's
  newest workspace connection of that integration and returned as
  `{ byConnection: { <connection id>: {...} } }`. A create or update whose entry has no
  workspace connection to bind to returns `422`; re-sending an entry already stored
  unchanged is accepted.
- Deleting a Files folder through context items also deletes its contained files,
  subfolders, and parsed file items.

## [0.7.0] — 2026-09-30

### Added

- **Scope Slack/Teams interfaces.** `scopes.interfaces(scopeId)` lists, adds, updates and
  removes the Slack and Microsoft Teams interfaces of a scope.
- **`claude-sonnet-5.5` model.** The chat request `model` union accepts the new
  Anthropic model.
- **`deepseek-v4-pro`, `deepseek-v4-flash-latest`, and `kimi-k3` models.** The
  chat request `model` union accepts these models.
- **Optional `ancestry` on context items.** List, get, lookup, and custom-item
  responses may include ordered ancestors (`uid`, `display_name`, `type`). The
  field is omitted on older responses, `null` when stored ancestry is unknown,
  and `[]` when the item has no ancestors.
- **`contextItemUids` on composed context.** `POST /modus/context` and
  `POST /scopes/{id}/context` now return the UIDs of the context items the composer
  kept, in selection order. Previously the response reported `selectedCount` with no
  way to learn which items it counted — `contextItems` has been an empty array for
  some time and remains deprecated.
- **`claude-opus-5.5` and `grok-4.7` models.** The chat request `model` union
  accepts the two new models.

### Removed

- **`RunConfigDto.strategies`.** The run API no longer publishes context-composer
  strategy IDs, so the generated `RunConfigDto` type no longer carries
  `strategies`. These IDs are the composer's internal vocabulary and get renamed,
  so a pinned value could silently stop doing anything. Strategy selection is
  chosen by the service.

### Added

- **Dashboard documents.** `mgmt.context.dashboards` document operations: list, get, create,
  updateDraft, publish, delete, versions, draft snapshots, access, ownership transfer
  (`list()`, `get()`, `create()`, `updateDraft()`, `publish()`, `delete()`,
  `listVersions()`, `getVersion()`, `restoreVersion()`, `listDraftSnapshots()`,
  `updateAccess()`, `requestOwnershipTransfer()`, `acceptOwnershipTransfer()`,
  `cancelOwnershipTransfer()`). New types `DashboardVersion`, `DashboardDraftSnapshot`,
  `DashboardPublishResult` and `DashboardView`, and the input types `CreateDashboardInput`,
  `UpdateDashboardDraftInput`, `PublishDashboardInput`, `UpdateDashboardAccessInput` and
  `TransferDashboardOwnershipInput`; version definitions are returned as stored, so older versions
  may lack newer fields.

- **Dashboard draft elements and layout.** `mgmt.context.dashboards.elements(dashboardId)`
  lists, reads, creates and updates the tiles and filters of a dashboard draft
  (`list()`, `get()`, `create()`, `update()`), and `mgmt.context.dashboards.updateLayout()`
  moves or resizes several of them in one change. Every write takes the `expectedRevision`
  it is based on and throws `ConflictError` when the draft changed.

- Ingested-data uploads accept an optional source HTTP `response.status` from 100 through 599.

- **File uploads: optional `folderPath`.** `uploadFromUrl`, `finalize`, and directory
  uploads now accept an optional relative folder label that is stored with the file and
  returned on the file resource. `uploadDir` sets it automatically from each file's path
  relative to the upload root, so directory structure is preserved.

- **Conversation lists: optional `source` and `sourceRef` filters.** `client.modus.conversations.list`
  and `client.scopes.conversations(scopeId).list` now accept `source` to restrict results to
  one UI surface (e.g. `"context_chat"`, `"dashboard_copilot"`, `"slack"`) and `sourceRef` to
  narrow `source` to one instance of that surface — for `dashboard_copilot`, a dashboard id.
  `sourceRef` requires `source`; sent on its own it is rejected with a 422. Conversations
  recorded before the filter shipped carry no instance key and do not match it.

### Changed

- **Scope MCP: Get Answer works alone.** `management.scopes.patchMcpConfig` now
  rejects a config that turns `coreTools.chat` (`get_answer`) on together with
  `getContext`, `teachModus` or any tool exposure, with HTTP 422. The call replaces the
  whole config and omitted keys take their defaults: `chat` off, `getContext` on,
  `teachModus` off, every tool exposed. To turn Get Answer on, send `chat: true`,
  `getContext: false` and an empty `subset` exposure in one call.

- **Breaking (pre-1.0):** Ingested-data upload results now contain only `checksum`;
  object keys are internal storage details.

- **Breaking (pre-1.0):** Directory-managed member groups no longer include member IDs.
  Use the member count to determine their size. Native member groups are unchanged.

## [0.6.0] — 2026-08-15

### Changed

- Public OpenAPI updates from production release.

## [0.5.0] — 2026-08-08

### Changed

- Public OpenAPI updates from production release.

## [0.4.0] — 2026-08-01

### Changed

- Public OpenAPI updates from production release.

## [0.3.0] — 2026-07-26
