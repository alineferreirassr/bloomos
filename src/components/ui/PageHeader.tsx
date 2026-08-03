import type { ComponentType, ReactNode, SVGProps } from "react";
import Link from "next/link";
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
export function PageHeader({ title, subtitle, actions, icon: Icon, breadcrumb, aiInsight, date }: PageHeaderProps) {
  return (
    <div className="animate-fade-down mb-6 flex flex-col gap-4">
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
        <div className="flex items-start gap-3">
          {Icon ? (
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100">
              <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
            </span>
          ) : null}
          <div>
            <h1 className="font-serif text-2xl font-semibold text-text text-balance">{title}</h1>
            {subtitle ? <p className="mt-1.5 text-sm text-text-muted">{subtitle}</p> : null}
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
