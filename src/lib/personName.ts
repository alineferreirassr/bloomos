/**
 * Concatenates a person-like record's first and last name for display.
 * Shared by Client and Lead records (and anywhere else that `first_name`/
 * `last_name` shape shows up — dropdown options, search haystacks, aria
 * labels), which previously each built this string inline.
 *
 * SOCIAL-13C-FND — `first_name`/`last_name` accept `string | null` (Lead's
 * own fields became nullable this checkpoint; Client's stay required
 * `string`, which is still assignable here). Never stringifies a missing
 * name as the literal word `"null"` the way naive template-literal
 * concatenation would — an absent part is simply omitted, so a
 * fully-unknown name resolves to `""`, one known part resolves to just
 * that part, and both known parts resolve exactly as before.
 */
export function getFullName(person: { first_name: string | null; last_name: string | null }): string {
  return [person.first_name, person.last_name].filter((part): part is string => Boolean(part)).join(" ");
}

/**
 * SOCIAL-13E/13F — a Lead-specific display name, structurally typed the
 * same way `getFullName` is (never imports `Lead` directly). Falls back to
 * the Lead's own real, already-observed Instagram handle when no name is
 * on file, and only then to a fixed, generic, stable label — never a
 * fabricated name. Originally introduced locally inside
 * `BookLeadConfirmModal.tsx` (SOCIAL-13E); shared here once a second
 * consumer (`CommercialPipelineCard.tsx`, SOCIAL-13F) needed the identical
 * fallback chain, rather than duplicating it a second time.
 */
export function getLeadDisplayName(lead: { first_name: string | null; last_name: string | null; instagram: string | null }): string {
  return getFullName(lead) || lead.instagram || "New Lead";
}
