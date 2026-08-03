"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/forms/FormField";
import { WORKSPACE_MEMBER_ROLES, WORKSPACE_MEMBER_ROLE_LABELS, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { WorkspaceInvitationWithToken } from "@/types/workspaceInvitation";
import type { DataResult } from "@/lib/data/result";

interface NewInvitationModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { email: string; invited_role: WorkspaceMemberRole }) => Promise<DataResult<WorkspaceInvitationWithToken>>;
  onCreated: (result: WorkspaceInvitationWithToken) => void;
}

export function NewInvitationModal({ open, onClose, onCreate, onCreated }: NewInvitationModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceMemberRole>("staff");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await onCreate({ email, invited_role: role });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setEmail("");
    setRole("staff");
    onClose();
    onCreated(result.data);
  };

  return (
    <Modal open={open} onClose={onClose} title="New Invitation">
      <div className="space-y-4">
        {error ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        <FormField label="Email" htmlFor="invitation_email_input" required>
          <Input
            id="invitation_email_input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <FormField label="Role" htmlFor="invitation_role_input" required>
          <Select id="invitation_role_input" value={role} onChange={(event) => setRole(event.target.value as WorkspaceMemberRole)}>
            {WORKSPACE_MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {WORKSPACE_MEMBER_ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
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
