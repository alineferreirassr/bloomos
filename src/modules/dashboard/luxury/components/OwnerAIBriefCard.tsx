"use client";

import { useEffect, useRef, useState } from "react";
import { generateDailyOperationsBrief } from "@/modules/ai/dailyBrief/generateDailyOperationsBrief";
import { DAILY_OPERATIONS_BRIEF_SKILL_ID } from "@/modules/ai/dailyBrief/registerDailyOperationsBriefSkill";
import { registerSkillRunner, unregisterSkillRunner } from "@/core/ai/skills/runnerRegistry";
import { AIInsightCard } from "@/modules/dashboard/luxury/components/AIInsightCard";
import { Button } from "@/components/ui/Button";

type State = { status: "idle" } | { status: "loading" } | { status: "ready"; summary: string; generatedAt: string } | { status: "error"; message: string };

/**
 * Checkpoint 19, Step 6 — the Owner Dashboard's "AI Executive Brief."
 * Reuses the exact same `generateDailyOperationsBrief()` Server Action the
 * now-retired Classical Dashboard's `DailyBriefCard` used to call — no
 * second AI summarizer — and takes over that component's own Bloom AI
 * Skill Picker runner registration too, so "Daily Operations Brief"
 * stays reachable from the global Skill Picker/Command Palette now that
 * this card is the only surface that renders it. Generation happens only
 * on a real click, never on page load: the Daily Brief's own execution
 * history persists metadata only, never the generated text itself
 * (`types/dailyBriefExecution.ts`), so there's nothing to passively read
 * on mount.
 */
export function OwnerAIBriefCard() {
  const [state, setState] = useState<State>({ status: "idle" });
  const generateRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const generate = async () => {
    setState({ status: "loading" });
    const result = await generateDailyOperationsBrief();
    if (!result.success) {
      setState({ status: "error", message: result.error });
      return;
    }
    setState({ status: "ready", summary: result.data.brief.executiveSummary, generatedAt: result.data.generatedAt });
  };

  useEffect(() => {
    generateRef.current = generate;
  });

  useEffect(() => {
    registerSkillRunner(DAILY_OPERATIONS_BRIEF_SKILL_ID, () => generateRef.current());
    return () => unregisterSkillRunner(DAILY_OPERATIONS_BRIEF_SKILL_ID);
  }, []);

  if (state.status === "ready") {
    return <AIInsightCard summary={state.summary} updatedLabel={new Date(state.generatedAt).toLocaleTimeString()} />;
  }

  return (
    <div>
      <AIInsightCard summary={null} updatedLabel={null} />
      {state.status === "error" ? <p className="mt-2 text-luxury-small text-luxury-critical">{state.message}</p> : null}
      <Button variant="secondary" onClick={generate} disabled={state.status === "loading"} className="mt-3">
        {state.status === "loading" ? "Generating…" : "Generate brief"}
      </Button>
    </div>
  );
}
