import type { ComponentType, ReactNode, SVGProps } from "react";
import Link from "next/link";

export function MetricRail({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export interface StatTileProps {
  label: string;
  value: string | number;
  meta?: string;
  href?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/**
 * GLOBAL-VISUAL-03B.2 — a direct structural port of AF Digital Studio OS's
 * `StatTile`/`MetricRail` (src/design-system/patterns/experience.tsx). AF's
 * real metric-card grammar: `rounded-2xl` (AF's own `--radius-2xl`, 28px —
 * not BloomOS's shared 20px `--radius-lg`, kept local to this tile rather
 * than changing the global token every other card relies on), 20px padding,
 * a hairline border, AF's exact `shadow-soft` value, a 36px icon chip, and a
 * 36px serif value. This is the real AF card used for KPIs — not a
 * BloomOS-invented "no card" treatment.
 */
export function StatTile({ label, value, meta, href, icon: Icon }: StatTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-100 text-accent">
          <Icon className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
        </span>
        {meta ? <span className="text-xs text-text-muted/80">{meta}</span> : null}
      </div>
      <div>
        <p className="font-serif text-[2.25rem] leading-none text-text tabular-nums">{value}</p>
        <p className="mt-1.5 text-sm text-text-muted">{label}</p>
      </div>
    </>
  );

  const className =
    "flex flex-col justify-between gap-5 rounded-[1.75rem] border border-border bg-surface p-5 transition-shadow duration-150";
  const style = { boxShadow: "0 1px 2px rgba(59,43,41,0.05), 0 1px 1px rgba(59,43,41,0.04)" };

  if (href) {
    return (
      <Link href={href} className={`${className} hover:shadow-md`} style={style}>
        {body}
      </Link>
    );
  }
  return (
    <div className={className} style={style}>
      {body}
    </div>
  );
}
