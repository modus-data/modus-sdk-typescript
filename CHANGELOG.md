# Changelog

Published versions come from the `sdk-typescript/v*` tags; the current release is
whatever [npm](https://www.npmjs.com/package/@getmodus/sdk) is serving. This file
records what changed, not which version is live.

Record concise, customer-visible release notes under `[Unreleased]` for every SDK
release, including pre-1.0 (`0.x`) releases.

## [Unreleased]

### Added

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
