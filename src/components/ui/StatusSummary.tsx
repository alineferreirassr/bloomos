import type { ComponentType, SVGProps } from "react";

export interface StatusSummaryItem {
  label: string;
  value: string | number;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * GLOBAL-VISUAL-03B.2/03B.3 — a direct structural port of AF Digital Studio
 * OS's `LiveStatusSummary` (src/design-system/patterns/experience.tsx):
 * 28px icon chip, 18px serif value, 12px label, `gap-x-6 gap-y-3`. Factored
 * out of `ModuleHero` (which still uses it for its own `status` slot,
 * matching AF's real ModuleHero usage of exactly one status item per hero
 * on every real AF hub page — Notifications/Leads/Pipeline) so the same
 * real component can also render standalone below a hero, the way this
 * checkpoint's fidelity pass needed for Relationships' remaining figures
 * without inventing a second metric system.
 */
export function StatusSummary({ items, className }: { items: StatusSummaryItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <dl className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${className ?? ""}`}>
      {items.map((item) => {
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
  );
}
