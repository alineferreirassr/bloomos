import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { DashboardMetric } from "@/lib/data";

/** GLOBAL-VISUAL-02B — opt-in `compact` (default false, every existing caller
 * unaffected) for a page that wants a subset of its metrics to read as
 * secondary/supporting rather than the same weight as its primary figures. */
export function MetricCard({ label, value, href, compact = false }: DashboardMetric & { compact?: boolean }) {
  return (
    <Link href={href} className="block">
      <Card className={`border-border/60 transition-colors duration-150 hover:border-accent/50 ${compact ? "p-3.5" : ""}`} style={{ borderRadius: 14 }}>
        <p className="text-[10px] tracking-[0.1em] text-accent uppercase">{label}</p>
        <p className={`mt-0.5 font-serif leading-tight font-semibold tabular-nums text-text ${compact ? "text-lg" : "text-[32px]"}`}>
          {value}
        </p>
      </Card>
    </Link>
  );
}
