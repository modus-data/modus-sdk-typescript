# Changelog

Published versions come from the `sdk-typescript/v*` tags; the current release is
whatever [npm](https://www.npmjs.com/package/@getmodus/sdk) is serving. This file
records what changed, not which version is live.

Record concise, customer-visible release notes under `[Unreleased]` for every SDK
release, including pre-1.0 (`0.x`) releases.

## [Unreleased]

### Changed

- **`searchQuery` documents word search.** `context.customItems.list({ searchQuery })` (`GET /context/custom-items`) describes
  word search: it returns rows that contain every word of the query, case-insensitive.

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
