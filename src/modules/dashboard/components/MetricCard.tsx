import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { DashboardMetric } from "@/lib/data";

export function MetricCard({ label, value, href }: DashboardMetric) {
  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:border-accent">
        <p className="text-sm text-text-muted">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-text">{value}</p>
      </Card>
    </Link>
  );
}
