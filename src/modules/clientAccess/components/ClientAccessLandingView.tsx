"use client";

import { useEffect } from "react";
import { updateClientLastAccess } from "@/lib/data";
import { useClientAccountSession } from "@/components/providers/ClientAccountSessionProvider";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const PLACEHOLDER_SECTIONS = ["Events", "Contracts", "Invoices", "Documents"] as const;

/**
 * Minimal Client Portal landing page (Client Accounts + Invitations
 * foundation, section 13) — exists only to verify client-only routing,
 * account context, auth separation, and active/suspended/revoked
 * behavior. Not the full Client Portal: the four sections below are
 * placeholders only, no real Events/Contracts/Invoices/Documents data —
 * that remains separately-scoped future work.
 */
export function ClientAccessLandingView() {
  const session = useClientAccountSession();

  useEffect(() => {
    updateClientLastAccess(session.accountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-text">Welcome, {session.clientName || "there"}</h1>
        <p className="mt-1 text-sm text-text-muted">
          Your {session.workspaceName} Client Portal account.
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text">Account status</span>
          <Badge tone="accent">Active</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PLACEHOLDER_SECTIONS.map((section) => (
          <Card key={section}>
            <h3 className="font-serif text-[15px] font-semibold text-text">{section}</h3>
            <p className="mt-1 text-xs text-text-muted">Coming soon.</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
