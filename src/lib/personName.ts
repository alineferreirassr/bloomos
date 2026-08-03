/**
 * Concatenates a person-like record's first and last name for display.
 * Shared by Client and Lead records (and anywhere else that `first_name`/
 * `last_name` shape shows up — dropdown options, search haystacks, aria
 * labels), which previously each built this string inline.
 */
export function getFullName(person: { first_name: string; last_name: string }): string {
  return `${person.first_name} ${person.last_name}`;
}
