"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { getPurchaseAssignedEvents } from "@/modules/operations/purchaseOperationsData";
import type { Event } from "@/types/event";

type LoadState = { status: "loading" } | { status: "ready"; events: Event[] } | { status: "error" };

/** v2 Checkpoint 21, Step 8 — which Event(s) this Purchase order fulfills. Quietly renders nothing on error. */
export function PurchaseAssignedEventsCard({ purchaseId }: { purchaseId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getPurchaseAssignedEvents(purchaseId).then(
      (events) => {
        if (!cancelled) setState({ status: "ready", events });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [purchaseId]);

  if (state.status === "loading") {
    return (
      <Card>
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  if (state.status === "error") return null;

  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Assigned Event</h3>
      {state.events.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">Not linked to a specific event&apos;s purchase requirement.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {state.events.map((event) => (
            <li key={event.id}>
              <Link href={`/events/${event.id}`} className="text-sm text-accent hover:underline">
                {event.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
