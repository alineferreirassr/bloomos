/**
 * The Documents domain's extension allow-list, surfaced in the document
 * filter UI (`modules/documents/components/DocumentFilters.tsx`). Every
 * other file-metadata concern (validation, normalization, checksums,
 * storage paths) lives in the Shared Media Library (`lib/media/`) — a
 * Document links to its physical file via `media_asset_id` rather than
 * duplicating that logic here.
 */
export const ALLOWED_FILE_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "mp4",
  "mov",
  "zip",
] as const;
