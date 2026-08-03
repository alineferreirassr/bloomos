import { registerDefaultTimelineActivityTypes } from "@/core/timeline";
import { registerDefaultSearchableEntities, setActiveSearchProvider } from "@/core/search";
import { workspaceSearchProvider } from "@/core/workspace/workspaceSearchProvider";

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
 * `registerDefaultSearchableEntities` + `setActiveSearchProvider` — v2.0
 * Checkpoint 38 is the "whoever owns Search's rollout" decision this
 * function's own comment used to defer: Smart Workspace's Global Search
 * widget is the first real caller of `runSearch()`, so wiring the registry
 * and a real provider here is this checkpoint's job. This has a side
 * effect beyond the new widget — the Command Palette's search box
 * (`CommandPalette.tsx`) and Bloom AI's Copilot panel search
 * (`CopilotPanel.tsx`) already called `runSearch()` but always got `[]`
 * back from the default `nullSearchProvider`; both start returning real
 * results the moment this line runs, with no changes to either file.
 */
export function initializeCore(): void {
  registerDefaultTimelineActivityTypes();
  registerDefaultSearchableEntities();
  setActiveSearchProvider(workspaceSearchProvider);
}
