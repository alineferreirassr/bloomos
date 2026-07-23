import type { JournalLine } from "@/types/journalEntry";

/** Empty at seed time — see journalEntriesStore.ts's own doc comment; lines are only ever created alongside an entry, by the same Finance Ledger write methods. */
const SEED_JOURNAL_LINES: JournalLine[] = [];

let journalLines: JournalLine[] = SEED_JOURNAL_LINES.map((line) => ({ ...line }));

export function readJournalLines(): JournalLine[] {
  return journalLines;
}

export function writeJournalLines(next: JournalLine[]): void {
  journalLines = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetJournalLinesStore(): void {
  journalLines = SEED_JOURNAL_LINES.map((line) => ({ ...line }));
}
