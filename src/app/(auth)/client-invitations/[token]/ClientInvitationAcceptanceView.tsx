"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { getClientInvitationByToken, acceptClientInvitation } from "@/lib/data";
import { signUpWithPassword } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import type { ClientInvitationPreview } from "@/types/clientInvitation";

type LoadState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "unavailable"; preview: ClientInvitationPreview; reason: string }
  | { status: "ready"; preview: ClientInvitationPreview };

/**
 * Client Portal invitation acceptance — mirrors InvitationAcceptanceView.tsx
 * (the internal Team invitation flow) exactly in shape, since the token/
 * sign-up/accept pattern is identical; only the underlying repository calls
 * and the post-acceptance destination (/client-access, never /dashboard —
 * a client is never routed into the internal Team Portal shell) differ.
 * Renders no internal navigation and no Team Portal shell — this page
 * lives under the (auth) route group, the same as every other pre-session
 * Auth page.
 */
export function ClientInvitationAcceptanceView({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"choose" | "signup">("choose");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getClientInvitationByToken(token).then((preview) => {
      if (cancelled) return;
      if (!preview) {
        setState({ status: "invalid" });
        return;
      }
      if (preview.status === "accepted") {
        setState({ status: "unavailable", preview, reason: "This invitation has already been accepted." });
        return;
      }
      if (preview.status === "revoked") {
        setState({ status: "unavailable", preview, reason: "This invitation has been revoked." });
        return;
      }
      if (preview.status === "expired" || new Date(preview.expires_at).getTime() < Date.now()) {
        setState({ status: "unavailable", preview, reason: "This invitation has expired." });
        return;
      }
      setState({ status: "ready", preview });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setIsAuthenticated(!!data.user);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = async () => {
    setActionError(null);
    setSubmitting(true);
    const result = await acceptClientInvitation(token);
    setSubmitting(false);
    if (!result.success) {
      setActionError(result.error);
      return;
    }
    router.push("/client-access");
  };

  const submitSignUp = async () => {
    if (state.status !== "ready") return;
    setActionError(null);
    setSubmitting(true);
    const result = await signUpWithPassword({
      email: state.preview.email,
      password,
      redirectTo: `/client-invitations/${token}`,
    });
    setSubmitting(false);
    if (result && !result.success) {
      setActionError(result.error);
      return;
    }
    // No redirect happened — Supabase requires email confirmation before a session exists.
    setCheckEmail(true);
  };

  if (state.status === "loading") {
    return (
      <Card>
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  if (state.status === "invalid") {
    return (
      <Card>
        <h1 className="mb-2 font-serif text-lg font-semibold text-text">Invalid invitation</h1>
        <p className="text-sm text-text-muted">This invitation link is invalid.</p>
      </Card>
    );
  }

  if (state.status === "unavailable") {
    return (
      <Card>
        <h1 className="mb-2 font-serif text-lg font-semibold text-text">{state.preview.workspace_name} Client Portal</h1>
        <p role="alert" className="text-sm text-text-muted">
          {state.reason}
        </p>
      </Card>
    );
  }

  const { preview } = state;

  return (
    <Card>
      <h1 className="mb-1 font-serif text-lg font-semibold text-text">
        You&apos;re invited to the {preview.workspace_name} Client Portal
      </h1>
      <p className="mb-4 text-sm text-text-muted">
        For <strong className="text-text">{preview.client_name}</strong> — {preview.email}
      </p>

      {actionError ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {actionError}
        </div>
      ) : null}

      {checkEmail ? (
        <p className="text-sm text-text-muted">
          Check your email ({preview.email}) to confirm your account, then return to this link to accept the invitation.
        </p>
      ) : isAuthenticated === null ? (
        <Skeleton className="h-10 w-full" />
      ) : isAuthenticated ? (
        <Button onClick={accept} disabled={submitting} className="w-full justify-center">
          {submitting ? "Accepting…" : "Accept Invitation"}
        </Button>
      ) : mode === "choose" ? (
        <div className="space-y-2">
          <Button onClick={() => setMode("signup")} className="w-full justify-center">
            Create your account
          </Button>
          <a
            href={`/sign-in?redirectTo=${encodeURIComponent(`/client-invitations/${token}`)}`}
            className="block w-full text-center text-xs text-accent hover:underline"
          >
            Already have an account? Sign in
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <FormField label="Email" htmlFor="client_invitation_email">
            <Input id="client_invitation_email" type="email" value={preview.email} disabled />
          </FormField>
          <FormField label="Password" htmlFor="client_invitation_password" required>
            <Input
              id="client_invitation_password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          <Button onClick={submitSignUp} disabled={submitting || password.length === 0} className="w-full justify-center">
            {submitting ? "Creating account…" : "Create account & continue"}
          </Button>
        </div>
      )}
    </Card>
  );
}
