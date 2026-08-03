"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { generateClientBrief } from "@/modules/ai/copilot/briefs/generateClientBrief";
import { BloomAiIcon } from "@/components/ui/icons";
import type { ClientBrief, BriefLine } from "@/modules/ai/copilot/briefs/types";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; brief: ClientBrief };

const TONE_TO_BADGE: Record<BriefLine["tone"], BadgeTone> = { info: "outline", success: "success", warning: "warning" };

/**
 * Checkpoint 20, Step 6 — the Client Portal's own "Ask Bloom" entry point.
 * Deliberately not the same `CopilotPanel` internal Team/Owner members get
 * (that panel is mounted only inside `(app)/layout.tsx`, gated on a real
 * Workspace member session) — a Client Account has no internal role/
 * permission concept at all (see `resolveDashboardExperience`'s own doc
 * comment), so it gets its own small, self-contained button+Modal, the
 * exact same shape `BloomAISkillPicker.tsx` already established for the
 * internal app before the Copilot Panel replaced its role there.
 */
export function ClientBriefButton() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    generateClientBrief().then(
      (brief) => {
        if (!cancelled) setState({ status: "ready", brief });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
        <BloomAiIcon className="h-4 w-4" aria-hidden="true" />
        Ask Bloom
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Bloom AI">
        {state.status === "loading" ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : null}
        {state.status === "error" ? <p className="text-sm text-danger">Your brief isn&apos;t available right now.</p> : null}
        {state.status === "ready" ? (
          <div className="space-y-3">
            <p className="font-serif text-base font-semibold text-text">{state.brief.greeting}</p>
            <p className="text-sm text-text-muted">{state.brief.summary}</p>
            <ul className="space-y-1.5">
              {state.brief.lines.map((line) => (
                <li key={line.id} className="flex items-start gap-2 text-sm text-text">
                  <Badge tone={TONE_TO_BADGE[line.tone]} className="mt-0.5 shrink-0" aria-hidden="true">
                    {line.tone === "warning" ? "!" : line.tone === "success" ? "✓" : "•"}
                  </Badge>
                  <span>{line.text}</span>
                </li>
              ))}
            </ul>
            {state.brief.nextStep ? (
              <div className="rounded-md bg-surface-tint p-3">
                <p className="text-xs font-medium tracking-wide text-text-muted uppercase">Next step</p>
                <p className="mt-1 text-sm text-text">{state.brief.nextStep}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
