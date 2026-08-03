import { createElement, type ReactNode } from "react";
import { resolveLuxuryIcon } from "@/modules/dashboard/luxury/resolveLuxuryIcon";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";

export interface ImportantNoteData {
  id: string;
  icon: string;
  title: string;
  description: string;
}

/** Checkpoint 19, Step 6/7/9 — the generic "icon + title + description" info card behind "Important Notes," "Don't forget" reminders, and (via `WeatherNoticeCard`) the weather notice — one component, several small call sites, never duplicated per notice type. */
export function ImportantNotesCard({ note, children }: { note: ImportantNoteData; children?: ReactNode }) {
  const iconElement = createElement(resolveLuxuryIcon(note.icon), { className: "h-4.5 w-4.5", "aria-hidden": true });
  return (
    <LuxuryCard tone="tint" className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-luxury-md bg-luxury-blush text-luxury-rose">{iconElement}</span>
      <div>
        <p className="text-luxury-body font-semibold text-luxury-text">{note.title}</p>
        <p className="mt-0.5 text-luxury-small text-luxury-text-muted">{note.description}</p>
        {children}
      </div>
    </LuxuryCard>
  );
}
