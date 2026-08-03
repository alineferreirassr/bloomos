"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BloomAvatar } from "@/components/ui/BloomAvatar";
import { BloomWelcomeBanner } from "@/components/ui/BloomWelcomeBanner";
import { BloomSectionDivider } from "@/components/ui/BloomSectionDivider";
import { WORKSPACE_MEMBER_ROLE_LABELS } from "@/core/enums/workspaceRole";
import { WORKSPACE_MEMBER_STATUS_LABELS } from "@/core/enums/workspaceMemberStatus";

/**
 * Minimal account/profile area for internal members (Team Portal MVP,
 * section 10) — display name, email, avatar, role, membership status,
 * Workspace name, sign-out, and a link to the already-existing
 * `/update-password` flow (the one profile action this phase wires up
 * rather than builds fresh, since `updatePassword()` already works for any
 * authenticated session, not only a post-reset one). Billing, MFA,
 * notification preferences, and account deletion are explicitly out of
 * scope this phase.
 */
export function AccountView() {
  const session = useMemberSession();
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

  const displayName = session.profile?.full_name ?? session.user?.email ?? "";
  const firstName = session.profile?.full_name?.trim().split(/\s+/)[0];

  return (
    <div>
      <BloomWelcomeBanner
        title={firstName ? `Welcome back, ${firstName}` : "Your Account"}
        subtitle="Your profile and Workspace membership."
      />

      <Card className="mt-6 max-w-md">
        <div className="flex items-center gap-3 border-b border-border pb-3.5">
          <BloomAvatar name={displayName || "?"} />
          <div className="min-w-0">
            <div className="truncate font-serif text-base font-semibold text-text">
              {session.profile?.full_name ?? "—"}
            </div>
            <div className="truncate text-xs text-text-muted">{session.user?.email ?? "—"}</div>
          </div>
        </div>

        <dl className="mt-3.5 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Role</dt>
            <dd className="text-text">
              {session.membership ? WORKSPACE_MEMBER_ROLE_LABELS[session.membership.role] : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Membership status</dt>
            <dd className="text-text">
              {session.membership ? WORKSPACE_MEMBER_STATUS_LABELS[session.membership.status] : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Workspace</dt>
            <dd className="text-text">{session.workspace?.name ?? "—"}</dd>
          </div>
        </dl>

        {error ? (
          <div
            role="alert"
            className="mt-3.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {error}
          </div>
        ) : null}

        <BloomSectionDivider className="mt-3.5" />

        <div className="mt-3.5 flex flex-col gap-2">
          <Link href="/update-password" className="text-center text-xs text-accent hover:underline">
            Change password
          </Link>
          <Button
            variant="secondary"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full justify-center"
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
