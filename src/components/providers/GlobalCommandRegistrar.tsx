"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerGlobalCommands } from "@/core/commandPalette/registerGlobalCommands";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

/**
 * v2.0 Checkpoint 40, then the App Shell architecture cleanup — mounted
 * once in `(app)/layout.tsx`, alongside `CommandPalette` — the one place
 * `registerGlobalCommands()` runs, so every "Open X"/"Create X" command is
 * findable from Cmd/Ctrl+K on every route, not only after visiting the page
 * that happens to register it locally (the pre-existing pattern every
 * per-module `register*Commands.ts` file already uses for its own
 * page-scoped actions). Renders nothing — this is registration only.
 *
 * Now also passes `can` from `useMemberSession()` through, so Cmd+K
 * commands are filtered by the exact same permission check the sidebar
 * uses — unauthorized destinations no longer appear in the palette at all
 * (see `registerGlobalCommands.ts`'s own doc comment for the drift/security
 * gap this closes). `can`'s closure is captured once on mount, deliberately
 * not re-run on every render — same reasoning the pre-existing
 * `router`-omission comment already established: `MemberSessionProvider`'s
 * `snapshot` is resolved server-side once per navigation and never
 * independently refreshed client-side (see that provider's own `loading`
 * field doc), so `can` cannot go stale mid-session; capturing it fresh on
 * every re-render would only thrash the shared command registry.
 */
export function GlobalCommandRegistrar() {
  const router = useRouter();
  const { can } = useMemberSession();

  useEffect(() => {
    const unregister = registerGlobalCommands((href) => router.push(href), can);
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `router` is stable per Next.js's own contract, and `can` cannot go stale mid-session (see doc comment above) — re-running this on every render would thrash the shared command registry for no benefit.
  }, []);

  return null;
}
