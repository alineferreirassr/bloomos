# File Storage Integration (Google Drive / Dropbox) — v2 Checkpoint 43

`core/integrations/providers/googleDrive/googleDriveProvider.ts` — `GoogleDriveProvider implements StorageProvider`. A plain `fetch` client against the Google Drive API v3 (multipart upload to `www.googleapis.com/upload/drive/v3/files`, metadata/list/delete against `www.googleapis.com/drive/v3/files`) — no `googleapis` npm SDK, for the same reason given in `docs/calendar-integration.md`.

## Methods

- `ping()` — `{ok, latencyMs, error?}`.
- `uploadFile({fileName, mimeType, content})` → `{externalId, url}`.
- `downloadFile(externalId)` → `{content, mimeType}`.
- `deleteFile(externalId)` → `{deleted}`.
- `listFiles({folderId?, cursor?})` → `{items, nextCursor}` — cursor-paginated, matching Drive's own `pageToken` model.

## Registration

`modules/integrations/providers/storageProviders.ts`: `google-drive`'s entry was updated in place (real-adapter description, `requiredPermission: "integrations.storage"`). `dropbox` was added alongside it as **provider-ready only** — registered in the Provider Registry with storage/oauth capabilities so it appears in the Connection Center and can be installed/walked through the connection state machine, but has no real adapter class in this checkpoint. This matches the checkpoint's own "Stripe priority, others provider-ready" instruction: Dropbox's real adapter is a follow-up, not a placeholder pretending to be real.

## Honest disclosure

No Google OAuth client is configured in this environment. `GoogleDriveProvider` is real and tested against a mocked `fetch`, but unverified against a live Google account. `dropbox` has no adapter at all — installing it produces a connection that can never leave `disconnected`/`failed`, honestly, rather than a fake "connected" state.

## Not built

Two-way file sync and conflict resolution for storage are out of scope; `syncEngine.ts`'s existing last-write-wins model (Checkpoint 22) is what a future sync job would use, unchanged by this checkpoint.
