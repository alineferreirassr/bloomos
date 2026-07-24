"use server";

import { randomUUID } from "node:crypto";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getAIProvider, isAIConfigured } from "@/core/ai";
import { fetchEventContextRecord } from "@/modules/ai/fetchEventContext.server";
import { buildEventOperationsBriefContext, EVENT_OPERATIONS_BRIEF_CONTEXT_VERSION } from "@/modules/ai/contextBuilder";
import { buildEventOperationsBriefPrompt, EVENT_OPERATIONS_BRIEF_PROMPT_VERSION } from "@/modules/ai/promptBuilder";
import { createMockAIProvider } from "@/modules/ai/mockProvider";
import { eventOperationsBriefModelOutputSchema } from "@/modules/ai/schema";
import { assembleEventOperationsBrief } from "@/modules/ai/assembleBrief";
import type { GenerateEventOperationsBriefResult } from "@/modules/ai/types";

const GENERIC_ACCESS_ERROR = "This Event brief isn't available. It may not exist, or you may not have access to it.";
const GENERIC_PROVIDER_ERROR = "Bloom AI couldn't generate a brief right now. Please try again.";
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
 * The only entry point the UI ever calls — everything from auth through
 * the provider call happens here, server-side, so no API key, prompt, or
 * raw Event data is ever exposed to the browser beyond the validated
 * structured result. Never trusts a client-supplied Workspace or
 * permission claim: both are re-resolved from the server session on every
 * call (`resolveMemberSessionSnapshot`), and the Event itself is re-fetched
 * server-side (`fetchEventContextRecord`) rather than accepting a
 * client-built context object. After Zod validates the model's raw output,
 * `assembleEventOperationsBrief` performs the additional *semantic*
 * cross-check schema validation alone can't express (risk kinds must match
 * ones BloomOS actually detected; action targets resolve only to real,
 * hardcoded routes).
 */
export async function generateEventOperationsBrief(eventId: string): Promise<GenerateEventOperationsBriefResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
  if (!session.permissions.includes("events.view")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  let record;
  try {
    record = await fetchEventContextRecord(eventId);
  } catch {
    return { success: false, error: GENERIC_PROVIDER_ERROR };
  }
  if (!record) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const context = buildEventOperationsBriefContext(record.event, record.client, record.checklist, record.schedule);
  const prompt = buildEventOperationsBriefPrompt(context);
  const mock = !isAIConfigured();
  const provider = getAIProvider() ?? createMockAIProvider();

  const now = new Date().toISOString();
  const conversation = {
    id: randomUUID(),
    workspaceId: session.workspace.id,
    context: {
      workspaceId: session.workspace.id,
      ownerType: "event" as const,
      ownerId: context.event.id,
      facts: { eventOperationsBriefContext: context },
    },
    messages: prompt,
    createdAt: now,
    updatedAt: now,
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

  const validated = eventOperationsBriefModelOutputSchema.safeParse(parsed);
  if (!validated.success) {
    return { success: false, error: "Bloom AI returned an unexpected response. Please try again." };
  }

  const brief = assembleEventOperationsBrief(validated.data, context);

  return {
    success: true,
    data: {
      context,
      brief,
      mock,
      model: completion.model,
      provider: provider.name,
      promptVersion: EVENT_OPERATIONS_BRIEF_PROMPT_VERSION,
      contextVersion: EVENT_OPERATIONS_BRIEF_CONTEXT_VERSION,
      sourceEventUpdatedAt: context.event.updatedAt,
      generatedAt: now,
    },
  };
}
