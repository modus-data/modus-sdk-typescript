# Changelog

Published versions come from the `sdk-typescript/v*` tags; the current release is
whatever [npm](https://www.npmjs.com/package/@getmodus/sdk) is serving. This file
records what changed, not which version is live.

Record concise, customer-visible release notes under `[Unreleased]` for every SDK
release, including pre-1.0 (`0.x`) releases.

## [Unreleased]

### Added

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
