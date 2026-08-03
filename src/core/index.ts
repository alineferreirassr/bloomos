/**
 * Core's umbrella barrel — one importable map of every shared architectural
 * concern, so "what does Core provide" has a single file to read instead of
 * needing to already know `src/core/`'s directory layout. Each concern's
 * own `index.ts` is still the real front door (import from
 * `@/core/notes` directly in real code); this file exists for discovery
 * and for the rare case something wants several concerns at once.
 *
 * Deliberately re-exported as namespaces, not flattened — Search and Notes
 * both have a `types.ts`, Tags and Comments both export a `CreateXInput`,
 * and so on; flattening would immediately collide.
 */
export * as CoreNotes from "@/core/notes";
export * as CoreTimeline from "@/core/timeline";
export * as CoreFiles from "@/core/files";
export * as CoreTags from "@/core/tags";
export * as CoreComments from "@/core/comments";
export * as CoreNotifications from "@/core/notifications";
export * as CoreAuditLog from "@/core/audit";
export * as CoreSearch from "@/core/search";
export * as CoreAI from "@/core/ai";
export * as CoreSharedTypes from "@/core/types/shared";
