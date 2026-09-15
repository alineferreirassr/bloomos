import { getInstagramCommentByExternalId, createInstagramComment, getInstagramConversationByExternalParticipantId, createInstagramConversation, getInstagramMessageByExternalId, createInstagramMessage, updateInstagramConversationLastMessageAt } from "@/lib/data";
import { dispatchAutomationTrigger, type ExecuteAutomationContext } from "@/core/automation/resolver";
import { getLogger } from "@/core/observability/logger";
import { clockNow } from "@/core/time/clock";
import type { AutomationTriggerEvent } from "@/types/automation";

/**
 * SOCIAL-11E — the Meta/Instagram webhook processing core, mirroring
 * `modules/integrations/stripe/webhookProcessing.ts`'s own exact role and
 * shape: update BloomOS's own domain records through the *existing*,
 * already-tested SOCIAL-11D repositories (never a second, parallel
 * persistence path), then fan out to the Automation Engine from the
 * *resulting* BloomOS state — never straight from the raw Meta payload.
 *
 * Called from `api/webhooks/meta/route.ts` *after* that route has already
 * verified the signature (SOCIAL-11C), resolved workspace ownership via
 * `instagram_account_identities`, and durably recorded the raw delivery in
 * `meta_webhook_events` — this module never re-does any of that, and never
 * accepts a workspace id from anywhere but its own caller-supplied,
 * already-server-resolved `workspaceId`.
 *
 * Deliberately narrow: no reply, no outbound Meta API call, no AI call, no
 * Lead creation, no CRM mutation — see this file's own action boundary in
 * `dispatchAutomationTrigger`'s own context below (`permissions: []`,
 * mirroring Stripe's exact webhook-dispatch shape) and the fact that zero
 * `AutomationDefinition` is registered for either new trigger type in this
 * checkpoint (a deliberate choice, not an oversight — see SOCIAL-11E's own
 * final report).
 *
 * Idempotency layering, kept strictly distinct (never mixed, per this
 * checkpoint's own explicit instruction):
 * 1. Webhook delivery idempotency — already fully handled by the caller
 *    (`automation_idempotency_keys`, SOCIAL-11B) before this module is
 *    ever invoked; this module trusts that it is being called for exactly
 *    one specific, already-claimed delivery.
 * 2. Domain entity deduplication — handled here, via SOCIAL-11D's own
 *    per-table UNIQUE constraints: a lookup-then-create pattern for the
 *    common case, with the create call's own controlled "duplicate" result
 *    handled as a benign no-op backstop for the rare case of two
 *    *different* webhook deliveries describing the same real comment/
 *    message (their own dedup keys necessarily differ, so layer 1 alone
 *    cannot catch this).
 * 3. Automation execution idempotency — entirely the Automation Engine's
 *    own existing concern (`core/automation/resolver.ts`/`manager.ts`,
 *    SOCIAL-11B's own durable `automation_executions`); this module only
 *    ever calls `dispatchAutomationTrigger` once per newly-created domain
 *    row, exactly once, and never re-dispatches for a domain row this
 *    module itself determined was a duplicate.
 */

const SYSTEM_DISPATCH_CONTEXT: ExecuteAutomationContext = { workspaceName: null, userId: null, userName: null, role: null, permissions: [] };

interface MetaCommentValue {
  id?: string;
  text?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string };
  parent_id?: string;
}

interface MetaMessagingEntry {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string };
}

export interface MetaWebhookEntryLike {
  id?: string;
  time?: number;
  changes?: Array<{ field?: string; value?: unknown }>;
  messaging?: unknown[];
}

export interface ProcessMetaWebhookEventInput {
  workspaceId: string;
  instagramAccountIdentityId: string;
  /** The business account's own external Instagram-scoped id — already verified/resolved by the caller; used only to determine message direction (sender vs. recipient), never re-resolved here. */
  externalAccountId: string;
  objectType: string;
  entry: MetaWebhookEntryLike | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseCommentValue(value: unknown): MetaCommentValue | null {
  if (!isRecord(value)) return null;
  const from = isRecord(value.from) ? { id: readString(value.from, "id"), username: readString(value.from, "username") } : undefined;
  const media = isRecord(value.media) ? { id: readString(value.media, "id") } : undefined;
  return {
    id: readString(value, "id"),
    text: readString(value, "text"),
    from,
    media,
    parent_id: readString(value, "parent_id"),
  };
}

function parseMessagingEntry(value: unknown): MetaMessagingEntry | null {
  if (!isRecord(value)) return null;
  const sender = isRecord(value.sender) ? { id: readString(value.sender, "id") } : undefined;
  const recipient = isRecord(value.recipient) ? { id: readString(value.recipient, "id") } : undefined;
  const message = isRecord(value.message) ? { mid: readString(value.message, "mid"), text: readString(value.message, "text") } : undefined;
  const timestamp = typeof value.timestamp === "number" ? value.timestamp : undefined;
  return { sender, recipient, timestamp, message };
}

async function dispatchInstagramTrigger(trigger: AutomationTriggerEvent): Promise<void> {
  try {
    await dispatchAutomationTrigger(trigger, SYSTEM_DISPATCH_CONTEXT);
  } catch (error) {
    // Mirrors socialPublishExecution.ts's/webhookProcessing.ts's own
    // discipline exactly: a trigger dispatch failure is logged, never
    // allowed to undo the domain row this module already durably
    // persisted, and never surfaces as a webhook-processing failure — the
    // Automation Engine's own execution/retry semantics (SOCIAL-11B) are
    // an entirely separate concern from "was this event correctly
    // ingested."
    getLogger().error(`${trigger.type} trigger dispatch failed`, { workspaceId: trigger.workspaceId, error: error instanceof Error ? error.message : "Unknown error" });
  }
}

/** True for the exact controlled "already recorded" message both SOCIAL-11D repositories return — the domain-level dedup backstop for two different webhook deliveries describing the same real comment/message. Never a fragile prefix/substring match. */
function isDuplicateDomainError(error: string): boolean {
  return error === "This Instagram comment has already been recorded." || error === "This Instagram conversation has already been recorded." || error === "This Instagram message has already been recorded.";
}

async function processCommentChange(input: ProcessMetaWebhookEventInput, value: unknown): Promise<void> {
  const parsed = parseCommentValue(value);
  if (!parsed?.id || !parsed.from?.id) {
    getLogger().warn("Meta webhook: comment event missing required fields — skipped, not an error", { workspaceId: input.workspaceId });
    return;
  }

  const existing = await getInstagramCommentByExternalId(input.instagramAccountIdentityId, parsed.id);
  if (existing) {
    getLogger().info("Meta webhook: comment already recorded — benign duplicate, no trigger re-dispatched", { workspaceId: input.workspaceId, commentId: existing.id });
    return;
  }

  const created = await createInstagramComment({
    workspaceId: input.workspaceId,
    instagramAccountIdentityId: input.instagramAccountIdentityId,
    externalCommentId: parsed.id,
    externalMediaId: parsed.media?.id ?? null,
    parentExternalCommentId: parsed.parent_id ?? null,
    externalAuthorId: parsed.from.id,
    externalAuthorUsername: parsed.from.username ?? null,
    content: parsed.text ?? "",
    externalCreatedAt: null,
  });

  if (!created.success) {
    if (isDuplicateDomainError(created.error)) {
      getLogger().info("Meta webhook: comment create raced a concurrent duplicate — benign, no trigger re-dispatched", { workspaceId: input.workspaceId });
      return;
    }
    throw new Error(created.error);
  }

  await dispatchInstagramTrigger({
    type: "instagram.comment_received",
    workspaceId: input.workspaceId,
    occurredAt: clockNow().toISOString(),
    actorMemberId: null,
    facts: {
      commentId: created.data.id,
      instagramAccountIdentityId: input.instagramAccountIdentityId,
      externalAuthorId: created.data.external_author_id,
      hasParent: created.data.parent_external_comment_id !== null,
      // SOCIAL-13B — enrichment only, both read straight off the just-created
      // domain row already in memory (no new query, no cross-workspace risk).
      // `commentText` mirrors `InstagramComment.content`'s own type (`string`,
      // never null — `processCommentChange` itself always coerces a missing
      // Meta `text` to `""` at create time, never `null`).
      // `externalAuthorUsername` mirrors `InstagramComment.external_author_username`
      // (`string | null`) verbatim — never fabricated, never falls back to
      // `externalAuthorId` when absent.
      commentText: created.data.content,
      externalAuthorUsername: created.data.external_author_username,
    },
  });
}

async function processMessagingEntry(input: ProcessMetaWebhookEventInput, value: unknown): Promise<void> {
  const parsed = parseMessagingEntry(value);
  if (!parsed?.message?.mid || !parsed.sender?.id || !parsed.recipient?.id) {
    getLogger().warn("Meta webhook: messaging event missing required fields — skipped, not an error", { workspaceId: input.workspaceId });
    return;
  }

  // The business account's own external id already came from the route's
  // own already-verified account resolution — never re-derived from the
  // payload. Whichever side isn't the business account is the external
  // participant.
  const isInbound = parsed.recipient.id === input.externalAccountId;
  const isOutbound = parsed.sender.id === input.externalAccountId;
  if (!isInbound && !isOutbound) {
    getLogger().warn("Meta webhook: messaging event names neither party as the resolved business account — skipped, not an error", { workspaceId: input.workspaceId });
    return;
  }
  const externalParticipantId = isInbound ? parsed.sender.id : parsed.recipient.id;

  let conversation = await getInstagramConversationByExternalParticipantId(input.instagramAccountIdentityId, externalParticipantId);
  if (!conversation) {
    const createdConversation = await createInstagramConversation({
      workspaceId: input.workspaceId,
      instagramAccountIdentityId: input.instagramAccountIdentityId,
      externalConversationId: null,
      externalParticipantId,
      externalParticipantUsername: null,
    });
    if (!createdConversation.success) {
      if (isDuplicateDomainError(createdConversation.error)) {
        conversation = await getInstagramConversationByExternalParticipantId(input.instagramAccountIdentityId, externalParticipantId);
        if (!conversation) throw new Error(createdConversation.error);
      } else {
        throw new Error(createdConversation.error);
      }
    } else {
      conversation = createdConversation.data;
    }
  }

  const existingMessage = await getInstagramMessageByExternalId(conversation.id, parsed.message.mid);
  if (existingMessage) {
    getLogger().info("Meta webhook: message already recorded — benign duplicate, no trigger re-dispatched", { workspaceId: input.workspaceId, messageId: existingMessage.id });
    return;
  }

  const externalCreatedAt = typeof parsed.timestamp === "number" ? new Date(parsed.timestamp).toISOString() : null;

  const created = await createInstagramMessage({
    conversationId: conversation.id,
    workspaceId: input.workspaceId,
    externalMessageId: parsed.message.mid,
    direction: isInbound ? "inbound" : "outbound",
    messageType: "text",
    content: parsed.message.text ?? null,
    externalMediaReference: null,
    externalCreatedAt,
  });

  if (!created.success) {
    if (isDuplicateDomainError(created.error)) {
      getLogger().info("Meta webhook: message create raced a concurrent duplicate — benign, no trigger re-dispatched", { workspaceId: input.workspaceId });
      return;
    }
    throw new Error(created.error);
  }

  await updateInstagramConversationLastMessageAt(conversation.id, externalCreatedAt ?? clockNow().toISOString());

  // Only an inbound message — one actually received from the external
  // participant — fires "message received." An outbound message Meta
  // itself reports (sent directly in the Instagram app, outside BloomOS)
  // is still durably persisted for a complete conversation history, but
  // is never treated as a "received" event — dispatching a trigger for
  // the business's own sent message would risk a future automation
  // reacting to its own output, a feedback-loop shape this checkpoint
  // deliberately avoids by construction, not by a runtime guard alone.
  if (!isInbound) return;

  await dispatchInstagramTrigger({
    type: "instagram.message_received",
    workspaceId: input.workspaceId,
    occurredAt: clockNow().toISOString(),
    actorMemberId: null,
    facts: {
      messageId: created.data.id,
      conversationId: conversation.id,
      instagramAccountIdentityId: input.instagramAccountIdentityId,
      direction: created.data.direction,
      // SOCIAL-13B — enrichment only, both read straight off domain rows
      // already resolved earlier in this same function (no new query, no
      // cross-workspace risk). `messageText` mirrors
      // `InstagramMessage.content`'s own type (`string | null`) verbatim.
      // `externalParticipantUsername` mirrors `InstagramConversation
      // .external_participant_username` (`string | null`) — deliberately
      // read from `conversation`, not `created.data` (the message row has
      // no username field of its own); today this is always `null` in
      // practice (nothing in the current ingestion pipeline ever populates
      // it — see `processMessagingEntry`'s own `externalParticipantUsername:
      // null` at conversation-creation time), never fabricated or
      // substituted with `externalParticipantId`.
      messageText: created.data.content,
      externalParticipantUsername: conversation.external_participant_username,
    },
  });
}

/**
 * The one entry point `api/webhooks/meta/route.ts` calls, once, per
 * already-claimed webhook delivery. Never throws for a benign "nothing to
 * process" outcome (unknown event shape, missing optional fields, a
 * detected duplicate) — only for a genuine processing failure, so the
 * caller's own existing try/catch (unmodified) correctly marks the
 * delivery `"failed"` (retryable) only when retrying could actually help.
 */
export async function processMetaWebhookEvent(input: ProcessMetaWebhookEventInput): Promise<void> {
  const entry = input.entry;
  if (!entry) return;

  const commentValue = entry.changes?.find((change) => change.field === "comments")?.value;
  if (commentValue !== undefined) {
    await processCommentChange(input, commentValue);
    return;
  }

  if (Array.isArray(entry.messaging) && entry.messaging.length > 0) {
    await processMessagingEntry(input, entry.messaging[0]);
    return;
  }

  // Any other object/field combination — durably recorded already by the
  // caller (meta_webhook_events), simply nothing this checkpoint's own
  // scope processes further. Never a failure.
}
