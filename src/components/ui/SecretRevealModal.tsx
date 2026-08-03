"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface SecretRevealModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  secret: string;
  /** What to call the credential in the body copy — "API Key", "Webhook Secret", etc. */
  kind: string;
}

/** Checkpoint 16 (originally `ApiKeySecretModal`), generalized in Checkpoint 17 for Webhook Secrets to reuse — the one moment a real credential is ever visible, mirroring `key_hash`'s own "never persisted, never re-derivable" guarantee. Shown once after Create or Rotate; closing this dialog is the caller's only chance to copy it. */
export function SecretRevealModal({ open, onClose, name, secret, kind }: SecretRevealModalProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      // Clipboard access can be denied — the secret is still visible to copy by hand.
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`"${name}" is ready`}>
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          Copy this {kind} now — for security, it won&apos;t be shown again. If it&apos;s lost, rotate it to issue a new one.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2">
          <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-accent">{secret}</code>
          <Button type="button" variant="secondary" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div role="status" className="sr-only">
          {copied ? `${kind} copied to clipboard.` : ""}
        </div>
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
