import type { MediaAsset } from "@/types/mediaAsset";

/**
 * v2.0 Checkpoint 25, Step 1 — the Asset Library's own broad categories,
 * derived from `mime_type`/`extension` rather than stored redundantly on
 * `MediaAsset` itself (one source of truth, matching every other derived
 * label in this codebase — e.g. `ownerLabelFor` in Documents).
 */
export const ASSET_CATEGORIES = [
  "image",
  "video",
  "pdf",
  "document",
  "spreadsheet",
  "presentation",
  "audio",
  "archive",
  "3d",
  "other",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  image: "Images",
  video: "Videos",
  pdf: "PDFs",
  document: "Documents",
  spreadsheet: "Spreadsheets",
  presentation: "Presentations",
  audio: "Audio",
  archive: "Archives",
  "3d": "3D Files",
  other: "Other",
};

const THREE_D_EXTENSIONS = new Set(["obj", "fbx", "gltf", "glb", "stl", "usdz"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz"]);

export function categorizeAsset(asset: Pick<MediaAsset, "mime_type" | "extension">): AssetCategory {
  const { mime_type: mimeType, extension } = asset;
  const ext = extension.toLowerCase();

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (THREE_D_EXTENSIONS.has(ext)) return "3d";
  if (ARCHIVE_EXTENSIONS.has(ext) || mimeType === "application/zip") return "archive";
  if (mimeType.includes("spreadsheet") || ext === "xlsx" || ext === "xls" || ext === "csv") return "spreadsheet";
  if (mimeType.includes("presentation") || ext === "pptx" || ext === "ppt") return "presentation";
  if (mimeType.includes("word") || mimeType === "text/plain" || ext === "docx" || ext === "doc" || ext === "txt") return "document";
  return "other";
}
