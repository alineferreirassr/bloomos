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

function CardBody({ data }: { data: LuxuryMetricCardData }) {
  const iconElement = createElement(resolveLuxuryIcon(data.icon), { className: "h-5 w-5 text-luxury-rose", "aria-hidden": true });
  return (
    <LuxuryCard className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-luxury-md bg-luxury-blush">{iconElement}</span>
      <div className="min-w-0">
        <p className="line-clamp-3 text-[0.6875rem] leading-tight font-medium break-words text-luxury-text-muted uppercase sm:text-luxury-metadata sm:tracking-wide lg:line-clamp-1">{data.label}</p>
        <p className="mt-1 font-luxury-display text-luxury-numeric font-semibold text-luxury-text">{data.value}</p>
        {data.helper ? <p className="mt-0.5 text-luxury-small text-luxury-text-muted">{data.helper}</p> : null}
      </div>
    </LuxuryCard>
  );
}

/** Checkpoint 19, Step 3/6 — the Owner/Team Dashboard's own top metric card (Revenue This Month, Today's Events, ...). `icon` is a plain string name (never a component reference), the same reasoning `MetricDefinition.icon`/`ConnectorDefinition.icon` already established, so `LuxuryDashboardData` stays a plain serializable DTO end to end. */
export function LuxuryMetricCard({ data }: { data: LuxuryMetricCardData }): ReactNode {
  if (data.href) {
    return (
      <Link href={data.href} className="block rounded-luxury-lg transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)]">
        <CardBody data={data} />
      </Link>
    );
  }
  return <CardBody data={data} />;
}
