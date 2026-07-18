"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Seeded by `(client-portal)/layout.tsx` only once its own resolution has
 * already confirmed `kind: "active"` — unauthenticated/no-account/blocked
 * states are all short-circuited by that layout before this provider ever
 * mounts, so every consumer can assume an active, legitimate Client
 * Portal session. Mirrors `MemberSessionProvider`'s "one canonical
 * context, no page independently re-fetches" precedent, scoped to the
 * Client Portal's own, wholly separate session model.
 */
export interface ClientAccountSessionValue {
  accountId: string;
  clientName: string;
  workspaceName: string;
  lastAccessAt: string | null;
}

const ClientAccountSessionContext = createContext<ClientAccountSessionValue | null>(null);

export function ClientAccountSessionProvider({
  value,
  children,
}: {
  value: ClientAccountSessionValue;
  children: ReactNode;
}) {
  return <ClientAccountSessionContext.Provider value={value}>{children}</ClientAccountSessionContext.Provider>;
}

/** Throws if rendered outside `ClientAccountSessionProvider` — every route under `(client-portal)` is wrapped by it via the shared layout, so a missing provider is a real bug, not a state to render around. */
export function useClientAccountSession(): ClientAccountSessionValue {
  const value = useContext(ClientAccountSessionContext);
  if (!value) throw new Error("useClientAccountSession must be used within a ClientAccountSessionProvider");
  return value;
}
