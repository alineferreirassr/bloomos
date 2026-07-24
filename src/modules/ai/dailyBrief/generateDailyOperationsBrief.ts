"use server";

import { randomUUID } from "node:crypto";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getAIProvider, isAIConfigured } from "@/core/ai";
import { fetchDailyOperationsBriefRecords } from "@/modules/ai/dailyBrief/fetchDailyOperationsBriefContext.server";
import { buildEventOperationsBriefContext } from "@/modules/ai/contextBuilder";
import { buildDailyOperationsBriefContext, DAILY_OPERATIONS_BRIEF_CONTEXT_VERSION } from "@/modules/ai/dailyBrief/contextBuilder";
import { buildDailyOperationsBriefPrompt, DAILY_OPERATIONS_BRIEF_PROMPT_VERSION } from "@/modules/ai/dailyBrief/promptBuilder";
import { createDailyOperationsBriefMockProvider } from "@/modules/ai/dailyBrief/mockProvider";
import { dailyOperationsBriefModelOutputSchema } from "@/modules/ai/dailyBrief/schema";
import { assembleDailyOperationsBrief } from "@/modules/ai/dailyBrief/assembleBrief";
import type { GenerateDailyOperationsBriefResult } from "@/modules/ai/dailyBrief/types";

const GENERIC_ACCESS_ERROR = "The Daily Operations Brief isn't available. You may not have access to it.";
const GENERIC_PROVIDER_ERROR = "Bloom AI couldn't generate the Daily Operations Brief right now. Please try again.";
const PROVIDER_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Bloom AI request timed out.")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Architecture for a future dashboard-level briefing — not yet wired to any
 * route or UI (see the architecture report). Mirrors
 * `generateEventOperationsBrief.ts`'s exact shape: server-only auth
 * (re-resolved, never client-trusted), deterministic context, provider call
 * with a mock fallback, schema validation, then semantic cross-validation
 * before assembly. Reuses `events.view` — this is a read-only, workspace-
 * wide aggregate of Events the caller can already see individually.
 */
export async function generateDailyOperationsBrief(): Promise<GenerateDailyOperationsBriefResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  if (!session.permissions.includes("events.view")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  let records;
  try {
    records = await fetchDailyOperationsBriefRecords();
  } catch {
    return { success: false, error: GENERIC_PROVIDER_ERROR };
  }

  const now = new Date();
  const eventContexts = records.map((record) =>
    buildEventOperationsBriefContext(record.event, record.client, record.checklist, record.schedule, now),
  );
  const context = buildDailyOperationsBriefContext(eventContexts, now);
  const prompt = buildDailyOperationsBriefPrompt(context);
  const mock = !isAIConfigured();
  const provider = getAIProvider() ?? createDailyOperationsBriefMockProvider();

  const nowIso = now.toISOString();
  const conversation = {
    id: randomUUID(),
    workspaceId: session.workspace.id,
    context: {
      workspaceId: session.workspace.id,
      facts: { dailyOperationsBriefContext: context },
    },
    messages: prompt,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  let completion;
  try {
    completion = await withTimeout(provider.complete({ conversation, prompt: prompt[prompt.length - 1] }), PROVIDER_TIMEOUT_MS);
  } catch {
    return { success: false, error: GENERIC_PROVIDER_ERROR };
  }

  if (completion.finishReason === "error") {
    return { success: false, error: GENERIC_PROVIDER_ERROR };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(completion.content);
  } catch {
    return { success: false, error: "Bloom AI returned a response that couldn't be read. Please try again." };
  }

  const validated = dailyOperationsBriefModelOutputSchema.safeParse(parsed);
  if (!validated.success) {
    return { success: false, error: "Bloom AI returned an unexpected response. Please try again." };
  }

  const brief = assembleDailyOperationsBrief(validated.data, context);

  return {
    success: true,
    data: {
      context,
      brief,
      mock,
      model: completion.model,
      provider: provider.name,
      promptVersion: DAILY_OPERATIONS_BRIEF_PROMPT_VERSION,
      contextVersion: DAILY_OPERATIONS_BRIEF_CONTEXT_VERSION,
      generatedAt: nowIso,
    },
  };
}
