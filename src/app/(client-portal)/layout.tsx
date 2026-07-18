"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { resolveClientAccountSessionSnapshot, type ClientAccountSessionSnapshot } from "@/lib/auth/clientAccountSession";
import { ClientAccountSessionProvider } from "@/components/providers/ClientAccountSessionProvider";
import { ClientPortalShell } from "@/components/layout/ClientPortalShell";
import { AccessBlockedPage } from "@/components/layout/AccessBlockedPage";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The Client Portal's own root gate — a wholly separate route group from
 * `(app)`, never nested under it. `unauthenticated` redirects to
 * `/sign-in` (defensive; middleware already covers this in supabase
 * mode). `no-account`/`blocked` render a bare, shell-less
 * `AccessBlockedPage` — reused directly from the Team Portal (it's
 * already generic: title/message/sign-out), never an auto-created
 * Client account, never a leak of business data. An active account is
 * wrapped in `ClientAccountSessionProvider` + the minimal
 * `ClientPortalShell` — never `AppShell`, never the internal Sidebar.
 */
export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ClientAccountSessionSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveClientAccountSessionSnapshot().then((next) => {
      if (cancelled) return;
      if (next.kind === "unauthenticated") {
        router.push("/sign-in");
        return;
      }
      setSnapshot(next);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!snapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-sm">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (snapshot.kind === "unauthenticated") {
    // Unreachable at runtime — the effect above already redirected before ever calling setSnapshot with this kind. Narrows the type for the branches below.
    return null;
  }

  if (snapshot.kind === "no-account") {
    return (
      <AccessBlockedPage
        brandSuffix="Client Portal"
        title="No Client Portal access"
        message="We couldn't find a Client Portal account for your sign-in. Ask your Amoré Bloom contact for an invitation."
      />
    );
  }

  if (snapshot.kind === "blocked") {
    return (
      <AccessBlockedPage
        brandSuffix="Client Portal"
        title="Account inactive"
        message={
          snapshot.status === "suspended"
            ? "Your Client Portal access has been suspended. Contact Amoré Bloom if you believe this is a mistake."
            : "Your Client Portal access is no longer active. Contact Amoré Bloom if you believe this is a mistake."
        }
      />
    );
  }

  if (snapshot.kind === "error") {
    return (
      <AccessBlockedPage
        brandSuffix="Client Portal"
        title="Something went wrong"
        message="We couldn't load your Client Portal account right now. Please try again in a moment."
      />
    );
  }

  return (
    <ClientAccountSessionProvider
      value={{
        authUserId: snapshot.authUserId,
        accountId: snapshot.accountId,
        clientId: snapshot.clientId,
        workspaceId: snapshot.workspaceId,
        email: snapshot.email,
        clientName: snapshot.clientName,
        workspaceName: snapshot.workspaceName,
        acceptedAt: snapshot.acceptedAt,
        lastAccessAt: snapshot.lastAccessAt,
      }}
    >
      <ClientPortalShell>{children}</ClientPortalShell>
    </ClientAccountSessionProvider>
  );
}
