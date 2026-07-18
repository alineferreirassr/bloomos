"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface AccessBlockedPageProps {
  title: string;
  message: string;
  /** Optional qualifier shown under the Amoré Bloom logo — e.g. "Client Portal", so an external blocked state never reads as the bare internal brand. Omitted entirely for internal Team Portal callers, unchanged. */
  brandSuffix?: string;
}

/**
 * Full-page state for the two cases where the `(app)` layout itself must
 * short-circuit before rendering `AppShell`/its Sidebar at all — "no
 * Workspace membership" and "membership exists but is inactive." Neither
 * case has a legitimate Workspace to navigate, so this deliberately mirrors
 * `(auth)/layout.tsx`'s bare centered-card treatment instead of showing an
 * empty/broken sidebar. Always offers sign-out (section 8's explicit
 * requirement) — mirrors `InvitationAcceptanceView`'s established pattern of
 * calling a Server Action and only navigating client-side when it resolves
 * without having already redirected server-side (mock mode never redirects
 * from `signOut()`, Supabase mode always does on success).
 */
export function AccessBlockedPage({ title, message, brandSuffix }: AccessBlockedPageProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    setLoggingOut(true);
    setError(null);
    const result = await signOut();
    setLoggingOut(false);
    if (result.success) {
      router.push("/sign-in");
      return;
    }
    setError(result.error);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/brand/amore-bloom-logo.png"
            alt="Amoré Bloom"
            width={640}
            height={426}
            priority
            className="h-auto w-48"
          />
          {brandSuffix ? (
            <div className="mt-1 text-[11px] tracking-[0.06em] text-text/55 uppercase">{brandSuffix}</div>
          ) : null}
        </div>
        <Card>
          <h1 className="mb-2 font-serif text-lg font-semibold text-text">{title}</h1>
          <p className="mb-4 text-sm text-text-muted">{message}</p>
          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {error}
            </div>
          ) : null}
          <Button variant="secondary" onClick={handleLogout} disabled={loggingOut} className="w-full justify-center">
            {loggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
