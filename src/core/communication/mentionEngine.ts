/**
 * v2.0 Checkpoint 24, Step 6 — Mentions. `parseMentions` is pure — it takes
 * a comment/message body plus the roster of names it could match against
 * (the caller already has this, from `getTeamMembers()` or equivalent; this
 * engine never fetches a roster itself), and returns which members (and
 * whether `@Team` — the whole roster) were mentioned. Longest-name-first
 * matching means "@Jane Smith" resolves to "Jane Smith" over a
 * shorter "Jane" if both exist, rather than the match order being
 * accidental.
 */

export interface MentionableMember {
  id: string;
  fullName: string;
}

export interface ParsedMentions {
  mentionedMemberIds: string[];
  mentionsTeam: boolean;
}

const MENTION_TOKEN_PATTERN = /@([A-Za-z][A-Za-z .'-]*)/g;

export function parseMentions(body: string, roster: MentionableMember[]): ParsedMentions {
  const sortedRoster = [...roster].sort((a, b) => b.fullName.length - a.fullName.length);
  const mentionedMemberIds = new Set<string>();
  let mentionsTeam = false;

  const matches = Array.from(body.matchAll(MENTION_TOKEN_PATTERN));
  for (const match of matches) {
    const candidateText = match[1].trim();
    if (/^team\b/i.test(candidateText)) {
      mentionsTeam = true;
      continue;
    }
    const member = sortedRoster.find((m) => candidateText.toLowerCase().startsWith(m.fullName.toLowerCase()));
    if (member) mentionedMemberIds.add(member.id);
  }

  return { mentionedMemberIds: Array.from(mentionedMemberIds), mentionsTeam };
}
