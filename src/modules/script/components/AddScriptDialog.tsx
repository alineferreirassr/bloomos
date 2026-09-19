"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createScriptItemAction, type ScriptItemActionInput } from "@/modules/script/scriptActions";
import type { ScriptItem } from "@/types/scriptItem";

interface AddScriptDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (item: ScriptItem) => void;
}

/**
 * SOCIAL-08D's own MVP Add flow, mirroring `AddIdeaDialog.tsx`'s own split
 * exactly: title only. `source_idea_id` is deliberately absent (sent as
 * null) — linking a Script to an Idea requires a picker, which lives in
 * `ScriptDetailDialog` instead, matching Idea's own precedent of never
 * adding a picker to its Add dialog. Calls `createScriptItemAction` only,
 * never a repository function directly.
 */
export function AddScriptDialog({ open, onClose, onCreated }: AddScriptDialogProps) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Same "adjust state during render on an open transition" pattern as
  // AddIdeaDialog.tsx — never a setState-in-effect.
  const [wasOpen, setWasOpen] = useState(!open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle("");
      setError(null);
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const input: ScriptItemActionInput = {
        title: title.trim(),
        source_idea_id: null,
      };
      const result = await createScriptItemAction(input);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onCreated(result.data);
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Script">
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="script-title" className="mb-1.5 block text-xs font-medium text-text-muted">
            Title
          </label>
          <Input
            id="script-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            invalid={!!error}
            placeholder="e.g. Spring wedding behind-the-scenes"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-1 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy} aria-busy={busy}>
            {busy ? "Creating…" : "Create Script"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
