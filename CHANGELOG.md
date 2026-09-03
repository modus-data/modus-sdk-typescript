# Changelog

Published versions come from the `sdk-typescript/v*` tags; the current release is
whatever [npm](https://www.npmjs.com/package/@getmodus/sdk) is serving. This file
records what changed, not which version is live.

Pre-1.0 (`0.x`) releases are internal. Detailed release notes are not maintained
until `1.0.0` — keep `[Unreleased]` empty while the package stays on `0.x`.

## [Unreleased]

### Added

- **File uploads: optional `folderPath`.** `uploadFromUrl`, `finalize`, and directory
  uploads now accept an optional relative folder label that is stored with the file and
  returned on the file resource. `uploadDir` sets it automatically from each file's path
  relative to the upload root, so directory structure is preserved.

### Changed

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
