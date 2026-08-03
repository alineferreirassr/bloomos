"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * The one place `@tanstack/react-query` is wired into the app. Feature
 * hooks (`modules/services/hooks/*`) are the only other files allowed to
 * import from `@tanstack/react-query` — the read layer
 * (`lib/queries/services/*`) and the repository (`lib/data/services/*`)
 * stay framework-agnostic and never know this provider exists.
 *
 * `useState(() => new QueryClient())` (not a module-scope singleton)
 * matches React Query's own documented Next.js App Router guidance: a
 * module-scope client would be shared across requests on the server and
 * across users, since Next.js can reuse the server module cache between
 * requests. Creating it once per component instance, lazily, keeps one
 * client per browser session without ever risking a server-side leak.
 */
const DEFAULT_STALE_TIME_MS = 30_000;

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: DEFAULT_STALE_TIME_MS,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
