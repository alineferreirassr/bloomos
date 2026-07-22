import type { EntityType } from "@/core/enums/entityType";

/**
 * Provider-agnostic Bloom AI architecture — see `docs/ai.md` for the vision
 * and guardrails this implements the shape of. No OpenAI/Anthropic/any
 * model integration exists here or anywhere in BloomOS yet; every shape
 * below is what a real provider will plug into later without any consuming
 * code changing, matching `docs/ai.md`'s own "explicitly out of scope for
 * now" boundary.
 */

/**
 * What Bloom AI is allowed to see for a given request — the "data-grounded,
 * not speculative" and "scoped to Workspace data" guardrails made concrete
 * as a type: a caller builds an `AIContext` from real BloomOS records
 * (never lets the model invent facts), and it's always workspace-scoped.
 * `ownerType`/`ownerId` optionally anchor the context to one entity (e.g.
 * summarizing one Event), matching the same polymorphic-owner shape as
 * Notes/Timeline/Comments rather than inventing a separate scoping concept.
 */
export interface AIContext {
  workspaceId: string;
  ownerType?: EntityType;
  ownerId?: string;
  /** Pre-fetched, data-grounded facts the provider may reference — never fetched by the provider itself (dependency inversion: Core supplies the data, the provider only reasons over it). */
  facts: Record<string, unknown>;
}

export interface AIPrompt {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * A multi-turn exchange — the unit Bloom AI's UI (once built) would
 * render and append to, not a single request/response pair.
 */
export interface AIConversation {
  id: string;
  workspaceId: string;
  context: AIContext;
  messages: AIPrompt[];
  createdAt: string;
  updatedAt: string;
}

/**
 * `requiresApproval` is the type-level expression of "assist, not replace"
 * — a provider marks any client-facing or financially consequential
 * completion as requiring human approval before it's ever sent or acted on;
 * this isn't optional UI polish, it's the guardrail itself.
 */
export interface AICompletion {
  content: string;
  requiresApproval: boolean;
  model: string;
  finishReason: "stop" | "length" | "error";
}

export interface AICompletionRequest {
  conversation: AIConversation;
  prompt: AIPrompt;
}

/**
 * The single seam a real model integration implements — OpenAI, Anthropic,
 * or any future provider. Nothing outside `core/ai` should ever import a
 * vendor SDK directly; every call goes through this interface, resolved via
 * `registry.ts`.
 */
export interface AIProvider {
  name: string;
  complete(request: AICompletionRequest): Promise<AICompletion>;
}
