import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { DashboardMetric } from "@/lib/data";

export function MetricCard({ label, value, href }: DashboardMetric) {
  return (
    <Link href={href} className="block">
      <Card className="transition-colors duration-150 hover:border-accent/50">
        <p className="text-[10px] tracking-[0.1em] text-accent uppercase">{label}</p>
        <p className="mt-0.5 font-serif text-[32px] leading-tight font-semibold tabular-nums text-text">
          {value}
        </p>
      </Card>
    </Link>
  );
}
