/** Labels only — no storage backend is connected yet. Every mock Document uses `"mock"`; `supabase`/`s3`/`local`/`other` exist so the schema doesn't need to change shape once real storage is wired up. */
export const STORAGE_PROVIDERS = ["mock", "supabase", "s3", "local", "other"] as const;

export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

export const STORAGE_PROVIDER_LABELS: Record<StorageProvider, string> = {
  mock: "Mock (no real storage)",
  supabase: "Supabase Storage",
  s3: "Amazon S3",
  local: "Local Filesystem",
  other: "Other",
};
