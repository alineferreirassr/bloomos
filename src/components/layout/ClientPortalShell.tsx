"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/Button";

/**
 * The Client Portal's own minimal shell — deliberately not `AppShell`
 * (no internal Sidebar, no Team navigation, no internal Dashboard). A
 * client account must never enter the internal Team Portal shell; see
 * docs/permissions.md. Branding reads "Amoré Bloom Client Portal", never
 * the bare Workspace name or the internal owner/non-owner variants.
 */
export function ClientPortalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    const result = await signOut();
    setLoggingOut(false);
    if (result.success) router.push("/sign-in");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Image src="/brand/amore-bloom-logo.png" alt="Amoré Bloom" width={640} height={426} priority className="h-8 w-auto" />
          <span className="text-xs tracking-[0.06em] text-text-muted uppercase">Client Portal</span>
        </div>
        <Button variant="secondary" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? "Signing out…" : "Sign out"}
        </Button>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
