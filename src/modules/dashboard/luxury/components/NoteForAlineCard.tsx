"use client";

import { useState, useTransition } from "react";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { LuxuryMessageIcon } from "@/modules/dashboard/luxury/luxuryIcons";
import { createFounderNoteAction } from "@/modules/dashboard/founderNoteActions";

/**
 * Intentionally different from the wellness cards: this note is meant to
 * reach Aline (Founder/Admin access, see `notes_to_founder`'s RLS) — the
 * opposite privacy shape from mood/water. The employee decides what to
 * write; nothing here ever reads or attaches mood/water-tracker data to
 * the note payload — `createFounderNoteAction` takes only the typed text.
 */
export function NoteForAlineCard() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    setError(null);
    setJustSent(false);
    startTransition(async () => {
      const result = await createFounderNoteAction(value);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setValue("");
      setJustSent(true);
    });
  }

  return (
    <LuxuryCard tone="tint">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-luxury-md bg-luxury-rose text-luxury-rose-foreground">
          <LuxuryMessageIcon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-luxury-small font-semibold text-luxury-text">Note for Aline</p>
          <p className="text-luxury-metadata font-medium tracking-wide text-luxury-rose uppercase">Shared with Aline only</p>
        </div>
      </div>
      <p className="mt-3 text-luxury-small text-luxury-text-muted">Private conversation with Aline — not visible to anyone else on the team.</p>
      <textarea
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setJustSent(false);
        }}
        placeholder="Write something just for Aline…"
        rows={3}
        className="mt-3 w-full resize-none rounded-luxury-md border border-luxury-border bg-luxury-surface p-3 text-luxury-small text-luxury-text placeholder:text-luxury-text-muted focus:border-luxury-rose focus:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)]"
      />
      {error ? <p className="mt-1.5 text-luxury-small text-red-600">{error}</p> : null}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSend}
          disabled={isPending || value.trim().length === 0}
          className="rounded-luxury-full bg-luxury-rose px-4 py-1.5 text-luxury-small font-medium text-luxury-rose-foreground transition-opacity duration-150 focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)] disabled:opacity-40"
        >
          Send
        </button>
        {justSent ? <span className="text-luxury-small text-luxury-text-muted">Sent ♡</span> : null}
      </div>
    </LuxuryCard>
  );
}
