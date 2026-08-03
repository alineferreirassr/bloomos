"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/forms/FormField";
import { updatePassword } from "@/lib/auth/actions";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => router.push("/sign-in"), 2500);
    return () => clearTimeout(timer);
  }, [success, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const result = await updatePassword({ password });
    setSubmitting(false);
    if (result && !result.success) {
      setFormError(result.error);
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <Card>
        <h1 className="mb-2 font-serif text-lg font-semibold text-text">Password updated</h1>
        <p className="text-sm text-text-muted">
          Your password has been changed. Redirecting you to sign in…
        </p>
        <a href="/sign-in" className="mt-4 block text-center text-xs text-accent hover:underline">
          Continue to sign in
        </a>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-4 font-serif text-lg font-semibold text-text">Set a new password</h1>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {formError}
          </div>
        ) : null}
        <FormField label="New password" htmlFor="new_password" required>
          <Input
            id="new_password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <FormField label="Confirm new password" htmlFor="confirm_password" required>
          <Input
            id="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </FormField>
        <Button type="submit" disabled={submitting} className="w-full justify-center">
          {submitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </Card>
  );
}
