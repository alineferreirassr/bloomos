import type { ReactNode } from "react";
import Link from "next/link";
import { NavChevronIcon } from "@/components/ui/icons";
import { StatusSummary, type StatusSummaryItem } from "@/components/ui/StatusSummary";

export interface ModuleHeroCrumb {
  label: string;
  href?: string;
}

interface ModuleHeroProps {
  eyebrow: string;
  title: string;
  purpose: string;
  breadcrumbs?: ModuleHeroCrumb[];
  actions?: ReactNode;
  status?: StatusSummaryItem[];
  source?: ReactNode;
  /**
   * AF's real compact hero variant, used by every dense list/detail work
   * screen (Leads, Contracts — verified against AF's own
   * app/(app)/app/leads/page.tsx): smaller title, a quieter one-line
   * purpose, tighter spacing so the work surface (table/board) arrives
   * sooner. Hub/landing pages (Relationships) keep the full editorial
   * hero — default false.
   */
  compact?: boolean;
}

/**
 * GLOBAL-VISUAL-03B.2 — a direct structural port of AF Digital Studio OS's
 * `ModuleHero` (src/design-system/patterns/experience.tsx, HEAD 1587d1f),
 * the real component AF's own Notifications/Leads/Pipeline hub pages use —
 * not a BloomOS reinterpretation. Every measurement below is the AF source
 * value, unchanged: eyebrow 12px tracked-[0.16em], title 32px→44px responsive
 * serif (`text-[2rem] sm:text-[2.75rem]`, `leading-[1.08]`), purpose 18px
 * (`text-lg leading-relaxed`, AF's `PurposeStatement`). Only colors are
 * mapped to BloomOS's existing tokens (AF's `accent-contrast`/`accent-soft`
 * → BloomOS `--color-accent`/`accent-100`) — AF's own brand hex is never
 * copied. Omits AF's `media`/`compact` variant slots (unused by this first
 * consumer, added back only when a page needs them).
 *
 * GLOBAL-VISUAL-03B.3 — `status` renders via the standalone `StatusSummary`
 * primitive (factored out so it can also render outside the hero). Verified
 * against every real AF ModuleHero call site (Notifications, Leads,
 * Pipeline): every one of them passes exactly ONE status item — this prop
 * is for a single headline figure, not a metrics dashboard.
 */
export function ModuleHero({ eyebrow, title, purpose, breadcrumbs, actions, status, source, compact = false }: ModuleHeroProps) {
  return (
    // font-crm-sans (AF's real Manrope interface sans, GLOBAL-VISUAL-04
    // addendum) cascades to every non-heading text here; the h1 below
    // keeps its own explicit font-serif (Cormorant, direct rule always
    // wins over an inherited family — not a specificity gamble).
    <header className="animate-fade-down font-crm-sans">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-xs text-text-muted">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={`${item.label}-${index}`} className="flex items-center gap-1">
                {item.href && !isLast ? (
                  <Link href={item.href} className="hover:text-text">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? undefined : "text-text-muted"}>{item.label}</span>
                )}
                {index < breadcrumbs.length - 1 ? <NavChevronIcon className="h-3 w-3 shrink-0" /> : null}
              </span>
            );
          })}
        </nav>
      ) : null}

      <p className="text-xs font-semibold tracking-[0.16em] text-accent uppercase">{eyebrow}</p>

      <div className={`flex flex-wrap items-end justify-between gap-4 ${compact ? "mt-2" : "mt-2"}`}>
        <div className="min-w-0">
          <h1
            className={`font-serif text-balance ${
              compact ? "text-[1.6rem] leading-tight sm:text-[2rem]" : "text-[2rem] leading-[1.08] sm:text-[2.75rem]"
            }`}
          >
            {title}
          </h1>
          {compact ? (
            <p className="mt-1.5 max-w-2xl text-sm text-text-muted">{purpose}</p>
          ) : (
            <p className="mt-3 max-w-xl text-lg leading-relaxed text-text-muted text-pretty">{purpose}</p>
          )}

          {status && status.length > 0 ? <StatusSummary items={status} className={compact ? "mt-4" : "mt-6"} /> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>

      {source ? <div className={compact ? "mt-3" : "mt-5"}>{source}</div> : null}
    </header>
  );
}
