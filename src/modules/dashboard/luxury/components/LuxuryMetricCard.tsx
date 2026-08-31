import Link from "next/link";
import { createElement, type ReactNode } from "react";
import { resolveLuxuryIcon } from "@/modules/dashboard/luxury/resolveLuxuryIcon";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";

export interface LuxuryMetricCardData {
  id: string;
  label: string;
  value: string;
  helper?: string | null;
  href?: string | null;
  icon: string;
}

function CardBody({ data, compact = false }: { data: LuxuryMetricCardData; compact?: boolean }) {
  const iconSize = compact ? "h-4 w-4 lg:h-5 lg:w-5" : "h-5 w-5";
  const iconElement = createElement(resolveLuxuryIcon(data.icon), { className: `${iconSize} text-luxury-rose`, "aria-hidden": true });
  const valueSize = compact ? "text-luxury-card-heading lg:text-luxury-numeric" : "text-luxury-numeric";
  return (
    <LuxuryCard padding={compact ? "compact" : "default"} className={`flex items-start gap-2 lg:gap-3 ${compact ? "lg:p-5" : ""}`}>
      <span className={`flex shrink-0 items-center justify-center rounded-luxury-md bg-luxury-blush ${compact ? "h-8 w-8 lg:h-11 lg:w-11" : "h-11 w-11"}`}>{iconElement}</span>
      <div className="min-w-0">
        <p className="line-clamp-3 text-[0.6875rem] leading-tight font-medium break-words text-luxury-text-muted uppercase sm:text-luxury-metadata sm:tracking-wide lg:line-clamp-1">{data.label}</p>
        <p className={`mt-1 font-luxury-display font-semibold break-words text-luxury-text ${valueSize}`}>{data.value}</p>
        {data.helper ? <p className="mt-0.5 text-luxury-small text-luxury-text-muted">{data.helper}</p> : null}
      </div>
    </LuxuryCard>
  );
}

/**
 * Checkpoint 19, Step 3/6 — the Owner/Team Dashboard's own top metric card
 * (Revenue This Month, Today's Events, ...). `icon` is a plain string name
 * (never a component reference), the same reasoning
 * `MetricDefinition.icon`/`ConnectorDefinition.icon` already established, so
 * `LuxuryDashboardData` stays a plain serializable DTO end to end.
 *
 * "Team + Client Responsive Desktop-Parity Refinement" — `compact` (opt-in,
 * default `false`) steps the value text down to `text-luxury-card-heading`
 * below `lg:`, only reaching the full 28px `text-luxury-numeric` at desktop
 * widths. Needed for Client Portal Summary's Journey Stage tile, whose value
 * is occasionally a multi-word phrase ("Portal Activated") rather than a
 * short number — at 28px in a narrow tablet/mobile column it either
 * overflowed the card or, once `break-words` was added, broke into an
 * illegible single-word-per-line stack. Owner/Team Dashboards never pass
 * `compact`, so their own short numeric/currency values render exactly as
 * before.
 */
export function LuxuryMetricCard({ data, compact = false }: { data: LuxuryMetricCardData; compact?: boolean }): ReactNode {
  if (data.href) {
    return (
      <Link href={data.href} className="block rounded-luxury-lg transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)]">
        <CardBody data={data} compact={compact} />
      </Link>
    );
  }
  return <CardBody data={data} compact={compact} />;
}
