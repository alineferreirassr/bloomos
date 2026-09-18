import { getSocialPost } from "@/lib/data";
import type { Lead } from "@/types/lead";
import type { LeadAttributionDisplay, LeadAttributionKind } from "@/modules/socialAttribution/types";

/**
 * SOCIAL-15D — the pure, synchronous classification `resolveLeadAttribution`
 * itself is built on, factored out so any caller that only needs the
 * *kind* (never the resolved Social Post's caption, so no fetch is
 * justified — e.g. Social Strategist's own context builder, which must
 * stay synchronous and side-effect-free) can classify a Lead without
 * duplicating this precedence logic.
 */
export function classifyLeadAttribution(lead: Lead): LeadAttributionKind {
  if (lead.social_post_id) return "social_post";
  if (lead.instagram_comment_id) return "instagram_comment";
  if (lead.instagram_conversation_id) return "instagram_conversation";
  return "none";
}

/**
 * Safe by construction, never re-verified against workspace here: `lead`
 * is always fetched through an already workspace-scoped read (e.g.
 * `getLeadById`), and `lead.social_post_id` is only ever written by
 * SOCIAL-15C's own workspace-safe capture pipeline — the id already
 * belongs to this Lead's own workspace by the time it reaches this
 * function. `getSocialPost` throws when the row is gone (deleted after
 * capture, or — once the SOCIAL-15B migration is applied — nulled by its
 * own `ON DELETE SET NULL`, in which case `lead.social_post_id` itself
 * would already be null and this branch wouldn't run); caught here so a
 * stale id degrades to "no resolvable post," never a crashed page.
 */
async function fetchSocialPostSafely(id: string) {
  try {
    const post = await getSocialPost(id);
    return { id: post.id, caption: post.caption };
  } catch {
    return null;
  }
}

/**
 * SOCIAL-15D — resolves ONE Lead's own stored attribution for display
 * (Lead Detail, and Client/Event Detail via their existing "Originating
 * Lead" relationship). Never an aggregate, never inferred: exactly the
 * three columns SOCIAL-15B added, read as-is. Deliberately exposes only
 * ids and the Social Post's own workspace-authored `caption` — never a
 * comment's or conversation's raw content, and never re-derives Instagram
 * username/participant PII beyond what `Lead.instagram` (a field this
 * codebase's UI already shows) already carries.
 */
export async function resolveLeadAttribution(lead: Lead): Promise<LeadAttributionDisplay> {
  const kind = classifyLeadAttribution(lead);

  if (kind === "social_post") {
    const socialPost = lead.social_post_id ? await fetchSocialPostSafely(lead.social_post_id) : null;
    return {
      kind,
      socialPost,
      comment: lead.instagram_comment_id ? { id: lead.instagram_comment_id } : null,
      conversation: null,
    };
  }

  if (kind === "instagram_comment") {
    return { kind, socialPost: null, comment: lead.instagram_comment_id ? { id: lead.instagram_comment_id } : null, conversation: null };
  }

  if (kind === "instagram_conversation") {
    return { kind, socialPost: null, comment: null, conversation: lead.instagram_conversation_id ? { id: lead.instagram_conversation_id } : null };
  }

  return { kind: "none", socialPost: null, comment: null, conversation: null };
}
