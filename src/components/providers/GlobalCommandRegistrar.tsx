"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerGlobalCommands } from "@/core/commandPalette/registerGlobalCommands";

/**
 * v2.0 Checkpoint 40 — Global Search & Universal Command Center. Mounted
 * once in `(app)/layout.tsx`, alongside `CommandPalette` — the one place
 * `registerGlobalCommands()` runs, so every "Open X"/"Create X" command is
 * findable from Cmd/Ctrl+K on every route, not only after visiting the page
 * that happens to register it locally (the pre-existing pattern every
 * per-module `register*Commands.ts` file already uses for its own
 * page-scoped actions). Renders nothing — this is registration only.
 */
export function GlobalCommandRegistrar() {
  const router = useRouter();

  useEffect(() => {
    const unregister = registerGlobalCommands((href) => router.push(href));
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `router` from useRouter() is stable per Next.js's own contract; re-running this on every render would thrash the shared command registry for no benefit.
  }, []);

  return null;
}
