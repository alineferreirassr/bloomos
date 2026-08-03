"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/money";
import { generatePaymentForecast, type PaymentForecast } from "@/modules/ai/copilot/assistants/financeForecast";

type LoadState = { status: "loading" } | { status: "ready"; forecast: PaymentForecast } | { status: "error" };

/** Checkpoint 20, Step 12 — the Finance Assistant's Payment Forecast, surfaced as a small additive card. */
export function PaymentForecastCard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    generatePaymentForecast().then(
      (forecast) => {
        if (!cancelled) setState({ status: "ready", forecast });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Informational-only card — a failed fetch just quietly disappears rather than showing an error banner over an otherwise-working page.
  if (state.status === "error") return null;

  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Bloom AI — Payment Forecast</p>
      {state.status === "loading" ? (
        <Skeleton className="mt-2 h-16 w-full" />
      ) : (
        <>
          <p className="mt-1.5 text-sm text-text">{state.forecast.summary}</p>
          <div className="mt-2.5 grid grid-cols-4 gap-2">
            {state.forecast.weeks.map((week) => (
              <div key={week.label} className="rounded-md bg-surface-tint p-2 text-center">
                <p className="text-[10px] tracking-wide text-text-muted uppercase">{week.label}</p>
                <p className="mt-0.5 text-xs font-semibold text-text">{formatMoney(week.totalMinor, state.forecast.currency)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
