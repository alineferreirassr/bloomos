import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { DashboardMetric } from "@/lib/data";

export function MetricCard({ label, value, href }: DashboardMetric) {
  return (
    <Link href={href} className="block">
      <Card className="transition-colors duration-150 hover:border-accent/50">
        <p className="text-xs font-medium tracking-wide text-text-muted uppercase">{label}</p>
        <p className="mt-3 text-3xl font-medium tracking-tight text-text">{value}</p>
      </Card>
    </Link>
  );
}
