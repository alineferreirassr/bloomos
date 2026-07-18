"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/actions";

/**
 * Seeded by `(client-portal)/layout.tsx` only once its own resolution has
 * already confirmed `kind: "active"` — unauthenticated/no-account/blocked
 * states are all short-circuited by that layout before this provider ever
 * mounts, so every consumer can assume an active, legitimate Client
 * Portal session. Mirrors `MemberSessionProvider`'s "one canonical
 * context, no page independently re-fetches" precedent, scoped to the
 * Client Portal's own, wholly separate session model.
 *
 * `isActive`/`canAccessPortal` are always `true` here — the layout never
 * mounts this provider for a blocked/missing/unauthenticated session —
 * kept as explicit fields (not derived ad hoc per page) so a page can
 * still express "only render this if the portal is accessible" without
 * re-deriving the same fact from `accountStatus` itself.
 */
export interface ClientAccountSessionValue {
  authUserId: string;
  accountId: string;
  clientId: string;
  workspaceId: string;
  email: string;
  clientName: string;
  workspaceName: string;
  accountStatus: "active";
  acceptedAt: string | null;
  lastAccessAt: string | null;
  isActive: boolean;
  canAccessPortal: boolean;
  logout: () => Promise<void>;
}

export type ClientAccountSessionSeed = Omit<ClientAccountSessionValue, "accountStatus" | "isActive" | "canAccessPortal" | "logout">;

const ClientAccountSessionContext = createContext<ClientAccountSessionValue | null>(null);

export function ClientAccountSessionProvider({
  value,
  children,
}: {
  value: ClientAccountSessionSeed;
  children: ReactNode;
}) {
  const router = useRouter();

  const logout = async () => {
    const result = await signOut();
    if (result.success) router.push("/sign-in");
  };

  const contextValue: ClientAccountSessionValue = {
    ...value,
    accountStatus: "active",
    isActive: true,
    canAccessPortal: true,
    logout,
  };

  return <ClientAccountSessionContext.Provider value={contextValue}>{children}</ClientAccountSessionContext.Provider>;
}

/** Throws if rendered outside `ClientAccountSessionProvider` — every route under `(client-portal)` is wrapped by it via the shared layout, so a missing provider is a real bug, not a state to render around. */
export function useClientAccountSession(): ClientAccountSessionValue {
  const value = useContext(ClientAccountSessionContext);
  if (!value) throw new Error("useClientAccountSession must be used within a ClientAccountSessionProvider");
  return value;
}
