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
