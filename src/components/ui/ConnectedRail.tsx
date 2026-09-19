import Link from "next/link";
import { NavChevronIcon } from "@/components/ui/icons";

export interface ConnectedRailStep {
  label: string;
  href?: string;
  current?: boolean;
}

/**
 * GLOBAL-VISUAL-03B.2 — a direct structural port of AF Digital Studio OS's
 * `ConnectedRail` (src/design-system/patterns/experience.tsx): a horizontal
 * strip of pills showing where the current page sits among its siblings —
 * the exact row the founder's Notifications/Leads screenshots show
 * ("Workspace → My tasks → Notifications → Timeline"). Same pill geometry
 * (rounded-full border px-3.5 py-1.5 text-sm), same current-state treatment
 * (accent border + soft accent fill), same horizontal-scroll-with-fade on
 * mobile. Only colors are mapped to BloomOS tokens.
 */
export function ConnectedRail({ items }: { items: ConnectedRailStep[] }) {
  return (
    <nav
      aria-label="Where this sits in your workflow"
      className="flex items-center gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,#000_calc(100%-1.75rem),transparent)] sm:[mask-image:none]"
    >
      {items.map((step, index) => {
        const chip = (
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors ${
              step.current
                ? "border-accent bg-accent-100 font-medium text-accent"
                : "border-border text-text-muted hover:border-accent/40 hover:text-text"
            }`}
            aria-current={step.current ? "step" : undefined}
          >
            {step.label}
          </span>
        );
        return (
          <span key={`${step.label}-${index}`} className="flex shrink-0 items-center gap-2">
            {index > 0 ? <NavChevronIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" /> : null}
            {step.href && !step.current ? (
              <Link href={step.href} className="shrink-0">
                {chip}
              </Link>
            ) : (
              chip
            )}
          </span>
        );
      })}
    </nav>
  );
}
