"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { generateInventoryAssistant, type InventoryAssistant } from "@/modules/ai/copilot/assistants/inventoryAssistant";

type LoadState = { status: "loading" } | { status: "ready"; assistant: InventoryAssistant } | { status: "error" };

/** Checkpoint 20, Step 13 — the Inventory Assistant, surfaced as a small additive card. */
export function InventoryAssistantCard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    generateInventoryAssistant().then(
      (assistant) => {
        if (!cancelled) setState({ status: "ready", assistant });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <Card>
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  // Informational-only card — a failed fetch just quietly disappears rather than showing an error banner over an otherwise-working page.
  if (state.status === "error") return null;

  const { assistant } = state;

  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Bloom AI — Inventory Assistant</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-surface-tint p-2">
          <p className="text-lg font-semibold text-text">{assistant.healthScore}%</p>
          <p className="text-[10px] tracking-wide text-text-muted uppercase">Health</p>
        </div>
        <div className="rounded-md bg-surface-tint p-2">
          <p className="text-lg font-semibold text-text">{assistant.lowStock.length}</p>
          <p className="text-[10px] tracking-wide text-text-muted uppercase">Low Stock</p>
        </div>
        <div className="rounded-md bg-surface-tint p-2">
          <p className="text-lg font-semibold text-text">{assistant.upcomingEventCount}</p>
          <p className="text-[10px] tracking-wide text-text-muted uppercase">Events (14d)</p>
        </div>
      </div>
      {assistant.suggestedPurchases.length > 0 ? (
        <ul className="mt-2.5 space-y-1 text-xs text-text">
          {assistant.suggestedPurchases.slice(0, 3).map((item) => (
            <li key={item.itemId}>
              Restock <span className="font-medium">{item.name}</span> ({item.quantityAvailable} left)
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-text-muted">{assistant.frequentlyUsedTogetherNote}</p>
    </Card>
  );
}
