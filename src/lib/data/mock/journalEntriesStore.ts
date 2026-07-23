import type { JournalEntry } from "@/types/journalEntry";

/**
 * Empty at seed time — nothing in mock mode posts a Journal Entry except
 * the Finance Ledger write methods this store backs (recordPaymentSettlement/
 * recordExpenseTransition/recordManualAdjustment/reverseJournalEntry).
 * Purchases/Inventory's own mock repositories simulate quantity/movement
 * changes directly and never call a posting RPC (mock or real), so they
 * don't populate this store either — same disclosed scope as every other
 * mock-mode limitation already noted in this codebase (e.g. Core Audit
 * Log's mock-only status).
 */
const SEED_JOURNAL_ENTRIES: JournalEntry[] = [];

let journalEntries: JournalEntry[] = SEED_JOURNAL_ENTRIES.map((entry) => ({ ...entry }));

export function readJournalEntries(): JournalEntry[] {
  return journalEntries;
}

export function writeJournalEntries(next: JournalEntry[]): void {
  journalEntries = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetJournalEntriesStore(): void {
  journalEntries = SEED_JOURNAL_ENTRIES.map((entry) => ({ ...entry }));
}
