import type { ComponentType, ReactNode, SVGProps } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { NavChevronIcon } from "@/components/ui/icons";

export interface PageHeaderBreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Optional icon shown beside the title, matching the module's own nav icon. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Optional trail above the title (e.g. Events / Malibu Sunset Proposal). The last item never links. */
  breadcrumb?: PageHeaderBreadcrumbItem[];
  /** A short, real-data-derived insight line (Step 6) — never a static placeholder. */
  aiInsight?: ReactNode;
  /** A real, already-known date string (e.g. "Tuesday, July 28") — never a fake/interactive date picker. */
  date?: string;
  /**
   * GLOBAL-VISUAL-02B pilot — a short uppercase domain label directly above
   * the title (e.g. "RELATIONSHIPS"), the same eyebrow grammar Dashboard's
   * own "TODAY'S STUDIO · {date}" uses (tracked-out, small, --color-accent-2
   * — the exact Classical-token equivalent of Dashboard's --luxury-coral,
   * confirmed identical in globals.css). Opt-in: every existing caller
   * without it renders identically.
   */
  eyebrow?: string;
  /** Opt-in — appends the same LuxuryHeartIcon Dashboard's own greeting uses. Only pass this where it genuinely reads as consistent with the page's own tone (see PageHeader's own doc comment); never applied automatically. */
  heart?: boolean;
}

/**
 * Checkpoint 19.1 — Global Luxury Rollout. Checkpoint 19.2, Step 5 extended
 * this with optional icon/breadcrumb/aiInsight/date slots — every existing
 * call site (title/subtitle/actions only) keeps rendering identically,
 * since all four are opt-in. The one shared hero header for every module
 * page (mirrors the Owner Dashboard's own "Good evening, Aline" treatment):
 * a large serif title, an elegant muted subtitle, and an optional actions
 * slot, all with luxury spacing.
 */
export function PageHeader({ title, subtitle, actions, icon: Icon, breadcrumb, aiInsight, date, eyebrow, heart }: PageHeaderProps) {
  return (
    <div className="animate-fade-down mb-7 flex flex-col gap-5">
      {breadcrumb && breadcrumb.length > 0 ? (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-text-muted">
          {breadcrumb.map((item, index) => {
            const isLast = index === breadcrumb.length - 1;
            return (
              <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 ? <NavChevronIcon className="h-3 w-3 shrink-0 opacity-50" /> : null}
                {item.href && !isLast ? (
                  <Link href={item.href} className="transition-colors duration-150 hover:text-text">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-text" : undefined}>{item.label}</span>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3.5">
          {Icon ? (
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent-100">
              <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
            </span>
          ) : null}
          <div>
            {eyebrow ? <p className="text-[11px] font-medium tracking-[0.16em] text-accent-2 uppercase">{eyebrow}</p> : null}
            {/* GLOBAL-VISUAL-02B — 1.75rem matches --luxury-text-page-size exactly (the
                same page-title scale Dashboard's own OwnerHomeHeader uses), replacing the
                smaller generic text-2xl so every inner page's title reads at the same
                weight as Dashboard's, without adopting its personalized greeting copy. */}
            <h1 className={`flex items-center gap-2.5 font-serif text-[1.75rem] leading-tight font-semibold text-text text-balance ${eyebrow ? "mt-1.5" : ""}`}>
              {title}
              {heart ? <Heart className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" strokeWidth={2} /> : null}
            </h1>
            {subtitle ? <p className="mt-2 text-sm text-text-muted">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {date ? <span className="text-sm text-text-muted">{date}</span> : null}
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </div>

      {aiInsight ? <div className="animate-fade-up stagger-1">{aiInsight}</div> : null}
    </div>
  );
}
