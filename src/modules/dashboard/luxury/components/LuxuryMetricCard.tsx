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
  /** GLOBAL-VISUAL-02B — an explicit per-metric tint override (a CSS color value,
   * e.g. "var(--luxury-success)"), for a consumer with several cards that share
   * one icon name but need distinct colors (icon name alone can't differentiate
   * them via ICON_TINT). Falls back to ICON_TINT[icon] when omitted, so every
   * existing caller renders unchanged. */
  tint?: string;
}

/**
 * GLOBAL-VISUAL-01 Round 4.4 — the approved `visual-system/round4`
 * prototype's `KpiCard` gives each metric its own tinted icon medallion
 * (varied color, not one uniform blush for every icon) — a real,
 * structural presentation difference from this card's prior single-tint
 * treatment, not just a sizing one. Mapped by icon name to the closest
 * semantically-fitting *existing* `--luxury-*` token (no new tokens
 * introduced) so every consumer (Owner Dashboard, Team Dashboard) picks
 * this up automatically.
 */
const ICON_TINT: Record<string, string> = {
  Revenue: "var(--luxury-coral)",
  Calendar: "var(--luxury-rose)",
  Users: "var(--luxury-success)",
  Task: "var(--luxury-warning)",
  Payment: "var(--luxury-critical)",
};

function CardBody({ data, compact = false }: { data: LuxuryMetricCardData; compact?: boolean }) {
  const iconSize = compact ? "h-4 w-4 lg:h-5 lg:w-5" : "h-[18px] w-[18px]";
  const tint = data.tint ?? ICON_TINT[data.icon] ?? "var(--luxury-rose)";
  const iconElement = createElement(resolveLuxuryIcon(data.icon), { className: iconSize, style: { color: tint }, "aria-hidden": true });
  const valueSize = compact ? "text-luxury-card-heading lg:text-luxury-numeric" : "text-[1.625rem]";
  return (
    <LuxuryCard
      padding={compact ? "compact" : "default"}
      className={`flex flex-col items-start gap-3.5 ${compact ? "lg:p-5" : "p-5"}`}
      style={{ borderRadius: 14 }}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full ${compact ? "h-8 w-8 lg:h-10 lg:w-10" : "h-10 w-10"}`}
        style={{ background: `color-mix(in srgb, ${tint} 16%, var(--luxury-surface))` }}
      >
        {iconElement}
      </span>
      <div className="min-w-0">
        <p className={`font-luxury-display leading-none font-medium break-words text-luxury-text ${valueSize}`}>{data.value}</p>
        <p className="mt-1.5 text-luxury-status leading-tight break-words text-luxury-text-muted">{data.label}</p>
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
