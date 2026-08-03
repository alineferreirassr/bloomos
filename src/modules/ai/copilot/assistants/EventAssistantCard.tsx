"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { generateEventAssistant, type EventAssistant } from "@/modules/ai/copilot/assistants/eventAssistant";

type LoadState = { status: "loading" } | { status: "ready"; assistant: EventAssistant } | { status: "error" };

/** Checkpoint 20, Step 14 — the Event Assistant, surfaced as a small additive card. Timeline/Checklist are already covered by `EventOperationsBriefSection`, mounted alongside this. */
export function EventAssistantCard({ eventId }: { eventId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    generateEventAssistant(eventId).then(
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
  }, [eventId]);

  if (state.status === "loading") {
    return (
      <Card>
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  // Informational-only card — a failed fetch just quietly disappears rather than showing an error banner over an otherwise-working Event page.
  if (state.status === "error") return null;

  const { assistant } = state;

  return (
    <Card>
      <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Bloom AI — Event Assistant</p>

      {assistant.packingList.length > 0 ? (
        <div className="mt-2">
          <p className="text-xs font-medium text-text">Packing List</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-text-muted">
            {assistant.packingList.slice(0, 4).map((item) => (
              <li key={item.itemName}>
                {item.itemName} × {item.quantity}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {assistant.shoppingList.length > 0 ? (
        <div className="mt-2">
          <p className="text-xs font-medium text-text">Shopping List</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-text-muted">
            {assistant.shoppingList.slice(0, 4).map((item) => (
              <li key={item.itemName}>
                {item.itemName} × {item.quantity}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {assistant.suggestedVendors.length > 0 ? (
        <p className="mt-2 text-xs text-text-muted">
          <span className="font-medium text-text">Suggested vendors:</span> {assistant.suggestedVendors.map((vendor) => vendor.companyName).join(", ")}
        </p>
      ) : null}

      {assistant.suggestedTeam.length > 0 ? (
        <p className="mt-1 text-xs text-text-muted">
          <span className="font-medium text-text">Suggested team:</span> {assistant.suggestedTeam.map((member) => member.name).join(", ")}
        </p>
      ) : null}

      {assistant.weatherReminder ? <p className="mt-2 text-xs text-text-muted">{assistant.weatherReminder}</p> : null}

      <p className="mt-2 text-xs text-text-muted">💡 {assistant.luxuryTips[0]}</p>
    </Card>
  );
}
