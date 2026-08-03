"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/forms/FormField";
import { API_SCOPES, API_SCOPE_DESCRIPTIONS, type ApiScope } from "@/types/apiScope";
import type { ApiKeyWithSecret, CreateApiKeyInput } from "@/types/apiKey";
import type { ManageApiKeysResult } from "@/modules/api/manageApiKeysActions";

interface CreateApiKeyModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateApiKeyInput) => Promise<ManageApiKeysResult<ApiKeyWithSecret>>;
  onCreated: (result: ApiKeyWithSecret) => void;
}

/** Checkpoint 16, Step 11 — the Developer Console's "Create API Key" form. Every `.write` scope is offered alongside every `.read` scope even though no endpoint checks a `.write` scope yet (see `types/apiScope.ts`'s own doc comment) — a member can still issue one, it just has no effect through any route today. */
export function CreateApiKeyModal({ open, onClose, onCreate, onCreated }: CreateApiKeyModalProps) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleScope = (scope: ApiScope) => {
    setScopes((current) => (current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope]));
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await onCreate({ name, scopes });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setName("");
    setScopes([]);
    onClose();
    onCreated(result.data);
  };

  return (
    <Modal open={open} onClose={onClose} title="New API Key">
      <div className="space-y-4">
        {error ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        <FormField label="Name" htmlFor="api_key_name_input" required>
          <Input id="api_key_name_input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Zapier integration" />
        </FormField>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-text">Scopes</legend>
          <div className="space-y-2">
            {API_SCOPES.map((scope) => (
              <label key={scope} className="flex items-start gap-2 text-sm text-text">
                <Checkbox checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} className="mt-0.5" />
                <span>
                  <span className="font-medium">{scope}</span>
                  <span className="block text-xs text-text-muted">{API_SCOPE_DESCRIPTIONS[scope]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={submit} disabled={submitting || name.trim().length === 0 || scopes.length === 0}>
            {submitting ? "Creating…" : "Create API Key"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
