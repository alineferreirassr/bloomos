"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { registerCommand, unregisterCommand } from "@/core/commandPalette";
import { getSkillRunner } from "@/core/ai/skills/runnerRegistry";
import { getBloomAIOverview } from "@/modules/ai/getBloomAIOverview";
import type { SkillMetadata } from "@/core/ai/skills/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; skills: SkillMetadata[] };

/**
 * The single "Ask Bloom" entry point. Checkpoint 4 replaces the several
 * individual AI commands each panel used to register on its own ("Generate
 * Proposal", "Open Proposal Draft", "Search Proposal", "Ask Bloom") with
 * exactly one: pick a Skill, run it. Every card here comes straight from
 * the Skill Registry (the same `skills` list the Bloom AI Dashboard
 * renders, via `getBloomAIOverview`) — a newly registered Skill appears
 * automatically, with zero changes to this file.
 *
 * Running an Active Skill delegates to whatever on-page panel registered
 * itself as that Skill's runner (`registerSkillRunner` — see
 * `EventOperationsBriefSection`/`ProposalGeneratorPanel`); a Skill with no
 * runner registered on the current page (e.g. this component mounted
 * somewhere with no matching Event context) falls back to navigating to
 * `/bloom-ai`, the Skill's own generic discovery surface. Self-contained
 * rather than dependent on the global `CommandPalette` shell being
 * mounted (it isn't, yet) — this also registers itself into the same
 * Command Palette registry, so it's found there for free once that shell
 * is ever mounted.
 */
export function BloomAISkillPicker() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const router = useRouter();

  useEffect(() => {
    registerCommand({
      id: "ask-bloom",
      label: "Ask Bloom",
      group: "Bloom AI",
      keywords: ["ai", "assistant", "skill", "proposal", "brief"],
      run: () => setOpen(true),
    });
    return () => unregisterCommand("ask-bloom");
  }, []);

  // No synchronous `setState` at the top of this effect (that's the exact
  // cascading-render pattern this project's lint config forbids, per
  // `DocumentsSummarySection`'s own precedent) — the picker just keeps
  // showing whatever it last loaded until the refetch below resolves,
  // rather than flashing back to a loading skeleton on every reopen.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getBloomAIOverview().then((result) => {
      if (cancelled) return;
      setState(result.success ? { status: "ready", skills: result.data.skills } : { status: "error", message: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  async function runSkill(skill: SkillMetadata) {
    close();
    const runner = getSkillRunner(skill.id);
    if (runner) {
      await runner();
      return;
    }
    router.push("/bloom-ai");
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Ask Bloom
      </Button>
      <Modal open={open} onClose={close} title="Ask Bloom">
        {state.status === "loading" ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : null}

        {state.status === "error" ? <p className="text-sm text-danger">{state.message}</p> : null}

        {state.status === "ready" ? (
          <ul className="space-y-1.5">
            {state.skills.map((skill) => (
              <li key={skill.id}>
                <button
                  type="button"
                  onClick={() => runSkill(skill)}
                  disabled={skill.status !== "active"}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2.5 text-left text-sm text-text hover:bg-text/7 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                >
                  <span>
                    <span className="block font-medium">{skill.name}</span>
                    <span className="block text-xs text-text-muted">{skill.description}</span>
                  </span>
                  {skill.status === "active" ? (
                    <Badge tone={skill.availability === "live" ? "accent" : "outline"}>{skill.availability === "live" ? "Live" : "Mock"}</Badge>
                  ) : (
                    <Badge tone="neutral">Coming Soon</Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Modal>
    </>
  );
}
