import { registerDefaultTimelineActivityTypes } from "@/core/timeline";

/**
 * The single, centralized place every Core "default registration" function
 * actually gets invoked in production — the piece `registerDefaultTimelineActivityTypes`
 * (core/timeline/defaultActivityTypeRegistrations.ts) was missing: it defined
 * *what* to register but nothing ever called it outside of tests. Wired into
 * the app's root layout (src/app/layout.tsx), which every request/page render
 * passes through regardless of NEXT_PUBLIC_DATA_MODE, so this runs before any
 * page can read a Timeline activity's label.
 *
 * Idempotent — the registration underneath is a Map.set() (see
 * core/timeline/activityTypeRegistry.ts), so calling this more than once
 * (hot reload, multiple module evaluations) is always safe and simply
 * re-applies the same entries.
 *
 * `registerDefaultSearchableEntities` (core/search/defaultRegistrations.ts)
 * is deliberately NOT called here yet — its own doc comment frames it as
 * intentionally opt-in, not yet an application default. Wiring Search's
 * defaults into production is a separate decision for whoever owns that
 * module's rollout, not something this Vendor-Timeline-focused fix should
 * decide. Add it here, alongside `registerDefaultTimelineActivityTypes`,
 * once that decision is made.
 */
export function initializeCore(): void {
  registerDefaultTimelineActivityTypes();
}
