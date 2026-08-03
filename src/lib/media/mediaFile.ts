/**
 * Generic, business-agnostic file validation and storage-path helpers for
 * the Media Library. Deliberately independent of `src/lib/documentFile.ts`
 * (the Documents module's own, older, metadata-only file helper) — no
 * imports either direction. See docs/database.md's Media Library section
 * for the full rationale.
 */

const ALLOWED_EXTENSIONS = new Set([
  // images
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "svg",
  // video
  "mp4",
  "mov",
  "webm",
  "avi",
  // audio
  "mp3",
  "wav",
  "m4a",
  "ogg",
  // documents
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "csv",
  "txt",
  // archives
  "zip",
  "rar",
  "7z",
]);

/** Always rejected, regardless of the allowlist above — executables and script files have no legitimate reason to be uploaded as an attachment. */
const BLOCKED_EXTENSIONS = new Set(["exe", "dmg", "pkg", "app", "js", "mjs", "sh", "bat", "cmd", "msi", "jar", "com"]);

const FILE_SIZE_LIMITS_BYTES: Record<string, number> = {
  image: 25 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  document: 50 * 1024 * 1024,
  archive: 100 * 1024 * 1024,
  other: 25 * 1024 * 1024,
};

function mimeCategory(mimeType: string): keyof typeof FILE_SIZE_LIMITS_BYTES {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf" || mimeType.startsWith("application/msword") || mimeType.includes("officedocument"))
    return "document";
  if (mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("archive")) return "archive";
  return "other";
}

export function extractFileExtension(fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

export function isAllowedFileExtension(extension: string): boolean {
  const ext = extension.toLowerCase();
  return !BLOCKED_EXTENSIONS.has(ext) && ALLOWED_EXTENSIONS.has(ext);
}

export interface ValidationOutcome {
  valid: boolean;
  error?: string;
}

export function validateMimeType(mimeType: string, extension: string): ValidationOutcome {
  if (!mimeType || !mimeType.includes("/")) {
    return { valid: false, error: "A valid MIME type is required." };
  }
  if (!isAllowedFileExtension(extension)) {
    return { valid: false, error: `Files with the ".${extension || "unknown"}" extension are not supported.` };
  }
  return { valid: true };
}

export function getFileSizeLimitBytes(mimeType: string): number {
  return FILE_SIZE_LIMITS_BYTES[mimeCategory(mimeType)];
}

export function validateFileSize(sizeBytes: number, mimeType: string): ValidationOutcome {
  if (sizeBytes <= 0) {
    return { valid: false, error: "The file appears to be empty." };
  }
  const limit = getFileSizeLimitBytes(mimeType);
  if (sizeBytes > limit) {
    const limitMb = Math.round(limit / (1024 * 1024));
    return { valid: false, error: `File is too large — the limit for this file type is ${limitMb} MB.` };
  }
  return { valid: true };
}

/** Normalizes an arbitrary uploaded file name into a safe, storage-friendly one — lowercased extension, unsafe characters stripped. */
export function generateStoredFilename(originalFileName: string): string {
  const extension = extractFileExtension(originalFileName);
  const base = originalFileName
    .slice(0, extension ? -(extension.length + 1) : undefined)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const safeBase = base || "file";
  return extension ? `${safeBase}.${extension}` : safeBase;
}

export interface StoragePathInput {
  workspaceId: string;
  ownerType: string;
  ownerId: string;
  mediaAssetId: string;
  version: number;
  storedFilename: string;
}

/** {workspaceId}/{ownerType}/{ownerId}/{mediaAssetId}/v{version}/{storedFilename} — the version segment means replacing a version never overwrites a prior version's bytes in Storage, even though only the latest metadata row is kept. */
export function generateStoragePath(input: StoragePathInput): string {
  const { workspaceId, ownerType, ownerId, mediaAssetId, version, storedFilename } = input;
  return `${workspaceId}/${ownerType}/${ownerId}/${mediaAssetId}/v${version}/${storedFilename}`;
}

export function isSafeStoragePath(path: string): boolean {
  if (path.startsWith("/")) return false;
  if (path.split("/").some((segment) => segment === "..")) return false;
  return true;
}
