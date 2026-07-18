"use client";

import { useState } from "react";
import { useClientAccountSession } from "@/components/providers/ClientAccountSessionProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

/**
 * Client Portal Account page (spec section 11) — display-only profile
 * summary plus logout. Deliberately no billing settings, MFA management,
 * password reset administration, account deletion, or notification
 * preferences this phase.
 */
export function ClientPortalAccountView() {
  const session = useClientAccountSession();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await session.logout();
  };

  const initials = session.clientName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold text-text">Account</h1>
      <p className="mt-1 text-sm text-text-muted">Your Client Portal profile.</p>

      <Card className="mt-6 max-w-md">
        <div className="flex items-center gap-3 border-b border-border pb-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 font-serif text-lg font-semibold text-accent">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate font-serif text-base font-semibold text-text">{session.clientName || "—"}</div>
            <div className="truncate text-xs text-text-muted">{session.email}</div>
          </div>
        </div>

        <dl className="mt-3.5 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Account status</dt>
            <dd className="capitalize text-text">{session.accountStatus}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Accepted</dt>
            <dd className="text-text">{session.acceptedAt ? new Date(session.acceptedAt).toLocaleDateString() : "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Last access</dt>
            <dd className="text-text">{session.lastAccessAt ? new Date(session.lastAccessAt).toLocaleDateString() : "—"}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Workspace</dt>
            <dd className="text-text">{session.workspaceName}</dd>
          </div>
        </dl>

        <div className="mt-3.5">
          <Button variant="secondary" onClick={handleLogout} disabled={loggingOut} className="w-full justify-center">
            {loggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
