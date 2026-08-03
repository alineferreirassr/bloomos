import Image from "next/image";
import { createElement, type ReactNode } from "react";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { StatusBadge, type StatusBadgeTone } from "@/modules/dashboard/luxury/components/StatusBadge";
import { resolveLuxuryIcon } from "@/modules/dashboard/luxury/resolveLuxuryIcon";

export interface EventHeroDetailRow {
  /** A plain icon-name string (resolved client-side via `resolveLuxuryIcon`) — never a rendered element, so `EventHeroCardData` stays a plain, serializable DTO returned safely from a Server Action. See the Analytics checkpoint's own serialization bug, documented in docs/luxury-design-system.md. */
  icon: string;
  label: string;
  value: string;
}

export interface EventHeroCardData {
  title: string;
  imageUrl: string | null;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  details: EventHeroDetailRow[];
}

/** Checkpoint 19, Step 3 — the large image-led hero card shared by the Team Dashboard's "Current Event" and the Client Dashboard's "Your Proposal" (Step 6 / Step 9's own named cards) — same composition, different `details` rows supplied by each caller, never two near-duplicate hero components. */
export function EventHeroCard({ data, footer }: { data: EventHeroCardData; footer?: ReactNode }) {
  return (
    <LuxuryCard className="p-0 overflow-hidden">
      <div className="relative h-48 w-full bg-luxury-blush sm:h-56">
        {data.imageUrl ? <Image src={data.imageUrl} alt="" fill sizes="100vw" className="object-cover" /> : null}
        <span className="absolute right-3 bottom-3">
          <StatusBadge label={data.statusLabel} tone={data.statusTone} />
        </span>
      </div>
      <div className="p-5">
        <h4 className="font-luxury-display text-luxury-page font-semibold text-luxury-text">{data.title}</h4>
        <dl className="mt-3 space-y-2">
          {data.details.map((row) => {
            const iconElement = createElement(resolveLuxuryIcon(row.icon), { className: "h-4 w-4", "aria-hidden": true });
            return (
              <div key={row.label} className="flex items-center gap-2 text-luxury-body">
                <span className="text-luxury-rose">{iconElement}</span>
                <dt className="w-24 shrink-0 text-luxury-text-muted">{row.label}</dt>
                <dd className="min-w-0 truncate text-luxury-text">{row.value}</dd>
              </div>
            );
          })}
        </dl>
        {footer ? <div className="mt-4">{footer}</div> : null}
      </div>
    </LuxuryCard>
  );
}
