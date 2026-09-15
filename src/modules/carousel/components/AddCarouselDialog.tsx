"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createCarouselItemAction, type CarouselItemActionInput } from "@/modules/carousel/carouselActions";
import type { CarouselItem } from "@/types/carouselItem";

interface AddCarouselDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (item: CarouselItem) => void;
}

/**
 * SOCIAL-10E's own MVP Add flow, mirroring `AddScriptDialog.tsx`'s own
 * split exactly: title only. `source_idea_id` is deliberately absent (sent
 * as null) — linking a Carousel to an Idea requires a picker, which lives
 * in `CarouselDetailDialog` instead, matching Script's own precedent of
 * never adding a picker to its Add dialog. Calls `createCarouselItemAction`
 * only, never a repository function directly.
 */
export function AddCarouselDialog({ open, onClose, onCreated }: AddCarouselDialogProps) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Same "adjust state during render on an open transition" pattern as
  // AddScriptDialog.tsx — never a setState-in-effect.
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
      const input: CarouselItemActionInput = {
        title: title.trim(),
        source_idea_id: null,
      };
      const result = await createCarouselItemAction(input);
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
    <Modal open={open} onClose={onClose} title="New Carousel">
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="carousel-title" className="mb-1.5 block text-xs font-medium text-text-muted">
            Title
          </label>
          <Input
            id="carousel-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
            invalid={!!error}
            placeholder="e.g. Autumn wedding carousel"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : null}

        <div className="mt-1 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy} aria-busy={busy}>
            {busy ? "Creating…" : "Create Carousel"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
