import type { ReactNode } from "react";
import Link from "next/link";

/**
 * GLOBAL-VISUAL-03B.2 — a direct structural port of AF Digital Studio OS's
 * Workspace `Card`/`Empty`/`RowLink` (app/(app)/app/_workspace/ui.tsx) —
 * the real component AF's own Workspace page uses for "Needs your
 * attention" and every other simple record list. Named `SimpleListCard`
 * here (BloomOS already has an unrelated `Card` primitive) to avoid a
 * naming collision, not a design change. Card: rounded-[1.75rem] border,
 * AF's exact shadow-soft, 20px padding, 18px serif title. `Empty`: AF's own
 * plain-sentence treatment (no icon, no extra box) — not the more
 * elaborate empty-state component BloomOS uses elsewhere; ported faithfully
 * because that IS what AF actually does here.
 */
export function SimpleListCard({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section
      className="rounded-[1.75rem] border border-border bg-surface p-5"
      style={{ boxShadow: "0 1px 2px rgba(59,43,41,0.05), 0 1px 1px rgba(59,43,41,0.04)" }}
    >
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-serif text-lg text-text">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SimpleListEmpty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-sm text-text-muted">{children}</p>;
}

export function RowLink({
  href,
  title,
  meta,
  trailing,
}: {
  href: string;
  title: string;
  meta?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-accent-100/40">
      <Link href={href} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-text">{title}</span>
        {meta ? <span className="block truncate text-xs text-text-muted">{meta}</span> : null}
      </Link>
      {trailing}
    </div>
  );
}
