/**
 * Checkpoint 16 — a dev-server-safe singleton for a mock store's mutable
 * state. Every mock store elsewhere in this codebase safely uses a plain
 * top-level `let` (see e.g. `clientPortalActivityStore.ts`) because it's
 * only ever imported from one side of the app: Server Components/Actions.
 * The Public API introduces a second, independently-compiled entry point —
 * Route Handlers under `app/api/v1/*` — and Next.js's dev server (both
 * Webpack and Turbopack) compiles Route Handlers and Server Actions into
 * separate module graphs, so a plain module-level variable ends up as two
 * independent copies: an API Key created via the Developer Console
 * (Server Action) would silently fail to authenticate through `/api/v1/*`
 * (Route Handler), and an API request logged by a route (Route Handler)
 * would never appear in the Developer Console's own Usage tab (Server
 * Action). Stashing the state on `globalThis` instead, keyed by a fixed
 * string, guarantees every module graph within the same Node process reads
 * and writes the exact same object — the same fix Next.js's own docs
 * recommend for caching a Prisma Client instance across hot reloads.
 *
 * Only stores actually read from one side and written from the other need
 * this — most mock stores in this codebase are seeded with static data at
 * module load (so every copy starts identical) and are never mutated
 * across that boundary, so they're unaffected and don't need it.
 */

declare global {
  var __bloomMockStores: Map<string, unknown> | undefined;
}

function stores(): Map<string, unknown> {
  globalThis.__bloomMockStores ??= new Map();
  return globalThis.__bloomMockStores;
}

export interface GlobalMockStore<T> {
  get: () => T;
  set: (value: T) => void;
}

/** `key` must be unique across every call site — a collision would silently share state between two unrelated stores. */
export function getGlobalMockStore<T>(key: string, init: () => T): GlobalMockStore<T> {
  if (!stores().has(key)) stores().set(key, init());
  return {
    get: () => stores().get(key) as T,
    set: (value: T) => {
      stores().set(key, value);
    },
  };
}
