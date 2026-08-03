import { getDataMode } from "@/lib/env";

/**
 * Centralized, data-mode-aware persistence disclaimer for list views. Reads
 * NEXT_PUBLIC_DATA_MODE once through lib/env.ts (the single switch) rather
 * than each component checking it directly — as more business modules
 * migrate to Supabase, they reuse this instead of duplicating the ternary.
 */
export function getDataPersistenceMessage(): string {
  return getDataMode() === "supabase"
    ? "Data is securely persisted to your Amoré Bloom Workspace."
    : "Data is temporary and resets on page reload — no database is connected yet.";
}
