"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/forms/FormField";
import { signInWithPassword } from "@/lib/auth/actions";

export function SignInForm({ redirectTo }: { redirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    const result = await signInWithPassword({ email, password, redirectTo });
    setSubmitting(false);
    if (result && !result.success) {
      setFormError(result.error);
    }
  };

  return (
    <Card>
      <h1 className="mb-4 font-serif text-lg font-semibold text-text">Sign in</h1>
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {formError}
          </div>
        ) : null}
        <FormField label="Email" htmlFor="sign_in_email" required>
          <Input
            id="sign_in_email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <FormField label="Password" htmlFor="sign_in_password" required>
          <Input
            id="sign_in_password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <Button type="submit" disabled={submitting} className="w-full justify-center">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <a href="/reset-password" className="mt-4 block text-center text-xs text-accent hover:underline">
        Forgot your password?
      </a>
    </Card>
  );
}
