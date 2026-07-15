/**
 * Centralized file-metadata helpers for the Documents domain. This is Phase
 * 1: metadata only — nothing here reads real file bytes, performs OCR or
 * image processing, or talks to an antivirus scanner. Every helper is pure
 * and deterministic, the same "one place this happens" precedent as
 * lib/money.ts for minor-unit arithmetic: normalizeFileName/
 * extractFileExtension/validateMimeType/validateFileSize/
 * generateStoragePath/generateDocumentTitle/calculateMockChecksum are the
 * only place file-name/size/path logic lives — the data layer and (later)
 * any upload UI call these rather than duplicating the rules ad hoc.
 */

export interface FileValidationResult {
  valid: boolean;
  error: string | null;
}

/** Extensions BloomOS accepts today — anything else is rejected by validateMimeType/the Document schema, even if the MIME type looks plausible. */
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

export type AllowedFileExtension = (typeof ALLOWED_FILE_EXTENSIONS)[number];

/** Explicitly rejected regardless of MIME type or future allow-list growth — executables and scripts must never be uploadable through this domain. */
export const BLOCKED_FILE_EXTENSIONS = ["exe", "dmg", "pkg", "app", "js", "sh", "bat", "cmd"] as const;

const IMAGE_EXTENSIONS: readonly string[] = ["jpg", "jpeg", "png", "webp", "heic"];
const PDF_EXTENSIONS: readonly string[] = ["pdf"];
const OFFICE_EXTENSIONS: readonly string[] = ["doc", "docx", "xls", "xlsx", "csv", "txt"];
const VIDEO_EXTENSIONS: readonly string[] = ["mp4", "mov"];
const ARCHIVE_EXTENSIONS: readonly string[] = ["zip"];

const BYTES_PER_MB = 1024 * 1024;

/** Per-category maximums. Any allowed extension not covered by a specific category (there currently is none) falls back to FALLBACK. */
export const FILE_SIZE_LIMITS_BYTES = {
  IMAGE: 25 * BYTES_PER_MB,
  PDF: 50 * BYTES_PER_MB,
  OFFICE: 50 * BYTES_PER_MB,
  VIDEO: 500 * BYTES_PER_MB,
  ARCHIVE: 100 * BYTES_PER_MB,
  FALLBACK: 25 * BYTES_PER_MB,
} as const;

const MIME_TYPES_BY_EXTENSION: Record<string, readonly string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  csv: ["text/csv"],
  txt: ["text/plain"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  heic: ["image/heic"],
  mp4: ["video/mp4"],
  mov: ["video/quicktime"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

/** True for any of the fifteen extensions BloomOS currently accepts (case-insensitive). */
export function isAllowedFileExtension(extension: string): extension is AllowedFileExtension {
  return (ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(extension.toLowerCase());
}

/** True for an extension that must never be accepted, independent of the allow-list. */
export function isBlockedFileExtension(extension: string): boolean {
  return (BLOCKED_FILE_EXTENSIONS as readonly string[]).includes(extension.toLowerCase());
}

/**
 * Strips path separators and unsafe characters, collapses whitespace/
 * repeated separators, and lowercases the extension — normalizeFileName("My
 * Contract (Final)/v2.PDF") => "my_contract_final_v2.pdf". Never throws;
 * an empty or all-unsafe input normalizes to "untitled".
 */
export function normalizeFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const extension = extractFileExtension(trimmed);
  const base = extension ? trimmed.slice(0, trimmed.length - extension.length - 1) : trimmed;

  const safeBase = base
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");

  const normalizedBase = safeBase.length > 0 ? safeBase : "untitled";
  return extension ? `${normalizedBase}.${extension.toLowerCase()}` : normalizedBase;
}

/** Returns the lowercase extension without its leading dot, or "" when the file name has none — extractFileExtension("Report.PDF") => "pdf". */
export function extractFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) return "";
  return trimmed.slice(lastDot + 1).toLowerCase();
}

/**
 * Checks the extension against the allow/block lists and, where BloomOS
 * knows the expected MIME type(s) for that extension, that `mimeType`
 * matches one of them. A blocked or unrecognized extension always fails
 * regardless of the supplied MIME type.
 */
export function validateMimeType(mimeType: string, extension: string): FileValidationResult {
  const ext = extension.toLowerCase();

  if (isBlockedFileExtension(ext)) {
    return { valid: false, error: `File type ".${ext}" is not allowed` };
  }
  if (!isAllowedFileExtension(ext)) {
    return { valid: false, error: `File type ".${ext}" is not supported` };
  }

  const expectedMimeTypes = MIME_TYPES_BY_EXTENSION[ext];
  if (expectedMimeTypes && !expectedMimeTypes.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: `MIME type "${mimeType}" does not match expected type for ".${ext}" (${expectedMimeTypes.join(" or ")})`,
    };
  }

  return { valid: true, error: null };
}

function fileSizeLimitBytesForExtension(extension: string): number {
  const ext = extension.toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return FILE_SIZE_LIMITS_BYTES.IMAGE;
  if (PDF_EXTENSIONS.includes(ext)) return FILE_SIZE_LIMITS_BYTES.PDF;
  if (OFFICE_EXTENSIONS.includes(ext)) return FILE_SIZE_LIMITS_BYTES.OFFICE;
  if (VIDEO_EXTENSIONS.includes(ext)) return FILE_SIZE_LIMITS_BYTES.VIDEO;
  if (ARCHIVE_EXTENSIONS.includes(ext)) return FILE_SIZE_LIMITS_BYTES.ARCHIVE;
  return FILE_SIZE_LIMITS_BYTES.FALLBACK;
}

/** Exported for callers (schema, summary helpers) that need to display or compare against the limit without re-deriving it. */
export function getFileSizeLimitBytes(extension: string): number {
  return fileSizeLimitBytesForExtension(extension);
}

/** Validates a positive, integer byte count against the category limit for `extension` (see FILE_SIZE_LIMITS_BYTES). */
export function validateFileSize(sizeBytes: number, extension: string): FileValidationResult {
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return { valid: false, error: "File size must be a positive integer number of bytes" };
  }

  const limitBytes = fileSizeLimitBytesForExtension(extension);
  if (sizeBytes > limitBytes) {
    const limitMb = Math.round(limitBytes / BYTES_PER_MB);
    return { valid: false, error: `File exceeds the ${limitMb}MB limit for ".${extension.toLowerCase()}" files` };
  }

  return { valid: true, error: null };
}

export interface StoragePathInput {
  workspaceId: string;
  ownerType: string;
  ownerId: string;
  fileName: string;
}

/**
 * Deterministic mock storage path — architecture only, no real object ever
 * lives at this path. Always relative (no leading slash) and always free of
 * `..` traversal, since normalizeFileName already strips path separators
 * from the file-name segment. generateStoragePath({ workspaceId: "ws_1",
 * ownerType: "client", ownerId: "client_1", fileName: "Contract.pdf" }) =>
 * "ws_1/client/client_1/contract.pdf".
 */
export function generateStoragePath(input: StoragePathInput): string {
  const safeFileName = normalizeFileName(input.fileName);
  return [input.workspaceId, input.ownerType, input.ownerId, safeFileName].join("/");
}

/** Derives a human-readable title from a file name — generateDocumentTitle("signed_contract-v2.pdf") => "Signed Contract V2". */
export function generateDocumentTitle(fileName: string): string {
  const extension = extractFileExtension(fileName);
  const base = extension ? fileName.slice(0, fileName.length - extension.length - 1) : fileName;

  const words = base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 0);

  if (words.length === 0) return "Untitled Document";

  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

/** A small, fast, non-cryptographic string hash (djb2) — deterministic but not collision-resistant; fine for a mock checksum, never used for integrity-critical comparisons. */
function djb2Hash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * A deterministic placeholder checksum derived from the file's metadata
 * (name + size), never its contents — no real file bytes exist to hash in
 * this phase. calculateMockChecksum("contract.pdf", 204800) always returns
 * the same value for the same inputs, which is enough to exercise
 * checksum-bearing code paths without a real storage backend.
 */
export function calculateMockChecksum(fileName: string, sizeBytes: number): string {
  return `mock_${djb2Hash(`${fileName}:${sizeBytes}`).toString(16).padStart(8, "0")}`;
}

/**
 * A storage path is "safe" when it's relative (no leading `/`) and contains
 * no `..` traversal segment — generateStoragePath always produces a safe
 * path; this exists so the Document schema and any hand-constructed path
 * (tests, future real-upload code) can be checked against the same rule.
 */
export function isSafeStoragePath(path: string): boolean {
  if (path.startsWith("/")) return false;
  if (path.split("/").includes("..")) return false;
  return true;
}
