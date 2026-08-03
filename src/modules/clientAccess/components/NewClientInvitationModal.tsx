"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/forms/FormField";
import type { ClientInvitationWithToken } from "@/types/clientInvitation";
import type { DataResult } from "@/lib/data/result";

interface NewClientInvitationModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { client_id: string; email: string }) => Promise<DataResult<ClientInvitationWithToken>>;
  onCreated: (result: ClientInvitationWithToken) => void;
  clientId: string;
  defaultEmail: string;
}

export function NewClientInvitationModal({ open, onClose, onCreate, onCreated, clientId, defaultEmail }: NewClientInvitationModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await onCreate({ client_id: clientId, email });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onClose();
    onCreated(result.data);
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite to Client Portal">
      <div className="space-y-4">
        {error ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        <FormField label="Email" htmlFor="client_invitation_email_input" required>
          <Input
            id="client_invitation_email_input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={submit} disabled={submitting || email.trim().length === 0}>
            {submitting ? "Sending…" : "Send Invitation"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
