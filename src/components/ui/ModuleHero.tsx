import type { ComponentType, ReactNode, SVGProps } from "react";
import Link from "next/link";
import { NavChevronIcon } from "@/components/ui/icons";

export interface ModuleHeroCrumb {
  label: string;
  href?: string;
}

export interface ModuleHeroStatusItem {
  label: string;
  value: string | number;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

interface ModuleHeroProps {
  eyebrow: string;
  title: string;
  purpose: string;
  breadcrumbs?: ModuleHeroCrumb[];
  actions?: ReactNode;
  status?: ModuleHeroStatusItem[];
  source?: ReactNode;
}

/**
 * GLOBAL-VISUAL-03B.2 — a direct structural port of AF Digital Studio OS's
 * `ModuleHero` (src/design-system/patterns/experience.tsx, HEAD 1587d1f),
 * the real component AF's own Notifications/Leads hub pages use — not a
 * BloomOS reinterpretation. Every measurement below is the AF source value,
 * unchanged: eyebrow 12px tracked-[0.16em], title 32px→44px responsive serif
 * (`text-[2rem] sm:text-[2.75rem]`, `leading-[1.08]`), purpose 18px
 * (`text-lg leading-relaxed`, AF's `PurposeStatement`), status row via the
 * same `LiveStatusSummary` grammar (28px icon chip, 18px serif value, 12px
 * label). Only colors are mapped to BloomOS's existing tokens (AF's
 * `accent-contrast`/`accent-soft` → BloomOS `--color-accent`/`accent-100`)
 * — AF's own brand hex is never copied. Omits AF's `media`/`compact` variant
 * slots (unused by this first consumer, added back only when a page needs
 * them, per the founder's own "don't build unused API surface" precedent).
 */
export function ModuleHero({ eyebrow, title, purpose, breadcrumbs, actions, status, source }: ModuleHeroProps) {
  return (
    <header className="animate-fade-down">
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

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[2rem] leading-[1.08] text-balance sm:text-[2.75rem]">{title}</h1>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-text-muted text-pretty">{purpose}</p>

          {status && status.length > 0 ? (
            <dl className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              {status.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-2">
                    {Icon ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-100 text-accent">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    ) : null}
                    <div className="leading-tight">
                      <dd className="font-serif text-lg text-text">{item.value}</dd>
                      <dt className="text-xs text-text-muted/80">{item.label}</dt>
                    </div>
                  </div>
                );
              })}
            </dl>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>

      {source ? <div className="mt-5">{source}</div> : null}
    </header>
  );
}
