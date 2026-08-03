"use client";

import { useEffect, useState } from "react";
import { getBenchmarkData, type BenchmarkData } from "@/modules/analytics/benchmark/getBenchmarkData";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatMoney } from "@/lib/money";
import { BENCHMARK_PERIODS, BENCHMARK_PERIOD_LABELS, type BenchmarkResult } from "@/types/businessIntelligence";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: BenchmarkData };

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function BenchmarkTable({ result, isMoney }: { result: BenchmarkResult; isMoney: boolean }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[17px] font-semibold text-text">{result.label}</h3>
        <div className="flex gap-2">
          <Badge tone={result.changeVsLastMonthPercent !== null && result.changeVsLastMonthPercent >= 0 ? "success" : "danger"}>vs. last month {formatPercent(result.changeVsLastMonthPercent)}</Badge>
          <Badge tone={result.changeVsSameMonthLastYearPercent !== null && result.changeVsSameMonthLastYearPercent >= 0 ? "success" : "danger"}>vs. last year {formatPercent(result.changeVsSameMonthLastYearPercent)}</Badge>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              {BENCHMARK_PERIODS.map((period) => (
                <th key={period} className="pb-2 pr-3 font-normal">
                  {BENCHMARK_PERIOD_LABELS[period]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {BENCHMARK_PERIODS.map((period) => (
                <td key={period} className="py-2 pr-3 tabular-nums text-text">
                  {isMoney ? formatMoney(result.values.find((v) => v.period === period)?.value ?? 0, "USD") : (result.values.find((v) => v.period === period)?.value ?? 0).toLocaleString()}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** v2 Checkpoint 23, Step 11 — Benchmark Center. */
export function BenchmarkPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () =>
    getBenchmarkData().then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "error", message: result.error });
    });

  useEffect(() => {
    fetchData();
  }, []);

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  const d = state.data;

  return (
    <div className="space-y-4">
      <BenchmarkTable result={d.revenue} isMoney />
      <BenchmarkTable result={d.profit} isMoney />
      <BenchmarkTable result={d.eventsBooked} isMoney={false} />
      <BenchmarkTable result={d.newClients} isMoney={false} />
    </div>
  );
}
