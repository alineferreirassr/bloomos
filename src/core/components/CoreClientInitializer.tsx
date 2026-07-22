"use client";

import { initializeCoreClient } from "@/core/initializeCoreClient";

// Module-scope, not inside the component body or a useEffect — this only
// needs to run once per client bundle evaluation, and the underlying
// registration is idempotent (see initializeCoreClient's doc comment), so
// there's no benefit to deferring it to an effect and no risk from Strict
// Mode's double-invoke or hot reload re-running it.
initializeCoreClient();

/**
 * Mounted once by the root layout (`src/app/layout.tsx`). Renders nothing —
 * its only job is to guarantee this module (and therefore the
 * `initializeCoreClient()` call above) is part of the browser's client
 * bundle. No feature-specific behavior lives here; add future client-side
 * Core registrations to `initializeCoreClient()`, never to this component.
 */
export function CoreClientInitializer() {
  return null;
}
