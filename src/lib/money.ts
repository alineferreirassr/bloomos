/**
 * BloomOS money model: every persisted monetary value is an integer count of
 * the currency's minor unit (e.g. $1,250.00 => 125000 cents), never a
 * floating-point number — floats can't represent currency exactly and would
 * silently drift across repeated add/subtract operations. This module is the
 * single place minor-unit arithmetic happens; Invoice/Payment/Expense fields
 * (subtotal_minor, tax_minor, total_minor, paid_minor, balance_minor,
 * amount_minor, ...) are always read/written through these helpers, never
 * computed ad hoc in the data layer or (later) in UI components.
 *
 * Every currency BloomOS supports today (USD and the other ISO codes
 * `contracts.currency`/`invoices.currency` already accept) uses a 2-decimal
 * minor unit (cents) — MINOR_UNIT_EXPONENT centralizes that assumption so a
 * future 0- or 3-decimal currency (JPY, KWD, ...) only needs one constant
 * changed, not a scan of every call site.
 */
export const MINOR_UNIT_EXPONENT = 2;
const MINOR_UNITS_PER_MAJOR = 10 ** MINOR_UNIT_EXPONENT;

function assertIntegerMinor(amountMinor: number, label: string): void {
  if (!Number.isInteger(amountMinor)) {
    throw new TypeError(`${label} must be an integer minor-unit amount, received ${amountMinor}`);
  }
}

/** Formats an integer minor-unit amount as a localized currency string — formatMoney(125000, "USD") => "$1,250.00". */
export function formatMoney(amountMinor: number, currency: string): string {
  assertIntegerMinor(amountMinor, "amountMinor");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountMinor / MINOR_UNITS_PER_MAJOR);
}

/** Converts an integer minor-unit amount to its major-unit decimal value (125000 => 1250) — for callers that need the raw number rather than a formatted string. */
export function minorToMajor(amountMinor: number): number {
  assertIntegerMinor(amountMinor, "amountMinor");
  return amountMinor / MINOR_UNITS_PER_MAJOR;
}

/** Converts a major-unit decimal amount (e.g. a form input) to an integer minor-unit amount (1250 => 125000), rounding to the nearest minor unit to absorb floating-point noise from the input. */
export function majorToMinor(amountMajor: number): number {
  return Math.round(amountMajor * MINOR_UNITS_PER_MAJOR);
}

/** Safe integer addition of minor-unit amounts — throws if either operand isn't an integer, so a float can never silently enter a persisted total. */
export function addMinor(a: number, b: number): number {
  assertIntegerMinor(a, "a");
  assertIntegerMinor(b, "b");
  return a + b;
}

/** Safe integer subtraction of minor-unit amounts (a - b). */
export function subtractMinor(a: number, b: number): number {
  assertIntegerMinor(a, "a");
  assertIntegerMinor(b, "b");
  return a - b;
}

/** Sums a list of integer minor-unit amounts safely. */
export function sumMinor(amounts: number[]): number {
  return amounts.reduce((total, amount) => addMinor(total, amount), 0);
}

/** balance = total - paid, floored at 0. A Payment/refund can never be applied past what's owed (enforced in the data layer), so a negative result here would indicate a bug upstream rather than a real state — clamping keeps every display honest. */
export function calculateBalance(totalMinor: number, paidMinor: number): number {
  return Math.max(0, subtractMinor(totalMinor, paidMinor));
}

/** Percentage of `whole` represented by `part`, rounded to the nearest integer; 0 when `whole` is 0 or negative (avoids a NaN/Infinity from a divide-by-zero on an unset total). */
export function calculatePercentage(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}
