"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/forms/FormField";
import { requestPasswordReset } from "@/lib/auth/actions";

export function ResetPasswordForm({ initialError }: { initialError?: string } = {}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(initialError ?? null);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const result = await requestPasswordReset({ email });
    setSubmitting(false);
    if (result.success) {
      setSent(true);
    } else {
      setFormError(result.error);
    }
  };

  if (sent) {
    return (
      <Card>
        <h1 className="mb-2 font-serif text-lg font-semibold text-text">Check your email</h1>
        <p className="text-sm text-text-muted">
          If an account exists for {email}, a password reset link has been sent.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-4 font-serif text-lg font-semibold text-text">Reset your password</h1>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {formError}
          </div>
        ) : null}
        <FormField label="Email" htmlFor="reset_email" required>
          <Input
            id="reset_email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <Button type="submit" disabled={submitting} className="w-full justify-center">
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <a href="/sign-in" className="mt-4 block text-center text-xs text-accent hover:underline">
        Back to sign in
      </a>
    </Card>
  );
}
