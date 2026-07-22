import { registerDefaultTimelineActivityTypes } from "@/core/timeline";

/**
 * The client-side counterpart to `initializeCore()` (`core/initializeCore.ts`).
 *
 * `initializeCore()` runs at module scope in `src/app/layout.tsx`, a Server
 * Component — but the Next.js App Router evaluates Server and Client
 * Component code as two separate module graphs (server process vs. browser
 * bundle). Registering the default Timeline activity types server-side never
 * reaches the registry a Client Component actually reads from at render
 * time, so a real browser session would show every Vendor activity's raw
 * type string (`vendor_created`) instead of its label ("Vendor created")
 * unless this client-side registration also runs.
 *
 * Invoked once by `CoreClientInitializer` (`core/components/CoreClientInitializer.tsx`),
 * mounted at the application root — never call this from a feature
 * component or repository directly.
 *
 * Idempotent for the same reason `initializeCore()` is: every registration
 * underneath is a `Map.set()` (see `core/timeline/activityTypeRegistry.ts`),
 * so re-running this (Strict Mode's double-invoke, hot reload, multiple
 * mounts) always just re-applies the same entries.
 */
export function initializeCoreClient(): void {
  registerDefaultTimelineActivityTypes();
}
