"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { getChecklistByEventId, completeChecklistItem, createEventNote, createExpense, uploadMediaAsset } from "@/lib/data";
import { validateMimeType, validateFileSize, extractFileExtension } from "@/lib/media/mediaFile";
import { logLiveEventEntry, getLiveEventLog } from "@/core/operations/operationsStore";
import { LIVE_EVENT_LOG_KIND_LABELS, type LiveEventLogEntry } from "@/types/liveEventLogEntry";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/core/enums/expenseCategory";
import type { Event } from "@/types/event";
import type { ChecklistItem } from "@/types/checklistItem";
import type { ExpenseInput } from "@/modules/finance/schema";

/** Plain JSON-shaped payload (strings/numbers/null/booleans, fixed key order) — string comparison is a safe, simple deep-equality check. */
function expensePayloadsEqual(a: ExpenseInput, b: ExpenseInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface LiveEventModePanelProps {
  event: Event;
  loggedByName: string;
  onClose: () => void;
  /** Called after any action that should refresh the Command Center's own data (checklist completion, a new log entry that feeds the Operations Timeline, etc.). */
  onChanged: () => void;
}

/**
 * v2 Checkpoint 21, Step 2 — Live Event Mode. Every action here reuses a
 * real BloomOS entity rather than inventing a new one: Complete Tasks
 * writes the real ChecklistItem, Upload Photos/Videos writes the real
 * MediaAsset, Add Notes writes the real Note, Register Expenses writes the
 * real Expense. Only Check In/Out, Report Issue, and Request Help persist
 * through the new OperationsStore (`logLiveEventEntry`) — see
 * `types/liveEventLogEntry.ts` for why those four have no existing entity
 * to reuse. Every write here feeds the Operations Timeline on next load.
 */
export function LiveEventModePanel({ event, loggedByName, onClose, onChanged }: LiveEventModePanelProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [log, setLog] = useState<LiveEventLogEntry[]>([]);
  const [noteText, setNoteText] = useState("");
  const [issueText, setIssueText] = useState("");
  const [helpText, setHelpText] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("miscellaneous");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * Finance F2.1C-F-E-D-B2: unlike NewExpenseView (a one-shot form that
   * navigates away on success), this panel stays mounted for an entire
   * event and is used to register MULTIPLE, independent, legitimate
   * Expenses in sequence — so a persistent request ref (rotate only on
   * payload change, otherwise reuse forever) would be unsafe: if the
   * Founder registers "Parking, $20", it succeeds, and later registers a
   * genuinely separate second "Parking, $20" (two real receipts of the
   * same amount are entirely plausible on-site), a persistent ref would
   * see the payload as unchanged since last time and silently replay the
   * first Expense instead of creating the second one — silently dropping
   * a real Expense the Founder believed they registered. Explicitly
   * resetting this ref to null after every successful create closes that
   * gap: the next submission always starts a fresh create-intent with a
   * new id, regardless of whether its payload coincidentally matches the
   * previous one, while a thrown-then-retried single attempt still
   * correctly reuses the same id (the reset only fires on success).
   */
  const expenseRequestRef = useRef<{ id: string; lastPayload: ExpenseInput | null } | null>(null);

  const refresh = () => {
    Promise.all([getChecklistByEventId(event.id), getLiveEventLog(event.id)]).then(([checklistResult, logResult]) => {
      setChecklist(checklistResult);
      setLog(logResult);
    });
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([getChecklistByEventId(event.id), getLiveEventLog(event.id)]).then(([checklistResult, logResult]) => {
      if (!cancelled) {
        setChecklist(checklistResult);
        setLog(logResult);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  const runAction = async (key: string, action: () => Promise<{ success: boolean; error?: string }>) => {
    setBusy(key);
    setError(null);
    const result = await action();
    setBusy(null);
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    refresh();
    onChanged();
  };

  const handleCheckIn = () => runAction("check_in", () => logLiveEventEntry(event.workspace_id, event.id, "check_in", `${loggedByName} checked in`, loggedByName));
  const handleCheckOut = () => runAction("check_out", () => logLiveEventEntry(event.workspace_id, event.id, "check_out", `${loggedByName} checked out`, loggedByName));

  const handleCompleteTask = (itemId: string) => runAction(`task_${itemId}`, () => completeChecklistItem(itemId));

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    runAction("note", async () => {
      const result = await createEventNote(event.id, { title: "Live Event Note", content: noteText.trim(), category: "reminder", priority: "normal" });
      if (result.success) setNoteText("");
      return result;
    });
  };

  const handleReportIssue = () => {
    if (!issueText.trim()) return;
    runAction("issue", async () => {
      const result = await logLiveEventEntry(event.workspace_id, event.id, "issue_reported", issueText.trim(), loggedByName);
      if (result.success) setIssueText("");
      return result;
    });
  };

  const handleRequestHelp = () => {
    runAction("help", async () => {
      const result = await logLiveEventEntry(event.workspace_id, event.id, "help_requested", helpText.trim() || null, loggedByName);
      if (result.success) setHelpText("");
      return result;
    });
  };

  const handleRegisterExpense = () => {
    const amountMinor = Math.round(Number(expenseAmount) * 100);
    if (!expenseDescription.trim() || !Number.isFinite(amountMinor) || amountMinor <= 0) {
      setError("Enter a description and a valid amount.");
      return;
    }
    runAction("expense", async () => {
      const payload: ExpenseInput = {
        event_id: event.id,
        client_id: event.client_id,
        contract_id: null,
        supplier_id: null,
        team_member_id: null,
        category: expenseCategory,
        description: expenseDescription.trim(),
        amount_minor: amountMinor,
        currency: "USD",
        transaction_date: new Date().toISOString().slice(0, 10),
        due_date: null,
        reimbursable: false,
        reference: null,
        notes: null,
      };

      if (expenseRequestRef.current === null) {
        expenseRequestRef.current = { id: crypto.randomUUID(), lastPayload: null };
      }
      const request = expenseRequestRef.current;
      const payloadChanged = request.lastPayload !== null && !expensePayloadsEqual(request.lastPayload, payload);
      const expenseId = payloadChanged ? crypto.randomUUID() : request.id;
      expenseRequestRef.current = { id: expenseId, lastPayload: payload };

      const result = await createExpense(payload, expenseId);
      if (result.success) {
        setExpenseDescription("");
        setExpenseAmount("");
        // Ends this create-intent's lifecycle now — the next submission
        // (even a coincidentally identical one) is treated as a genuinely
        // new Expense, never mistaken for a replay of this one.
        expenseRequestRef.current = null;
      }
      return result;
    });
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    const extension = extractFileExtension(file.name);
    const mimeCheck = validateMimeType(file.type, extension);
    if (!mimeCheck.valid) {
      setError(mimeCheck.error ?? "Unsupported file type.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const sizeCheck = validateFileSize(file.size, file.type);
    if (!sizeCheck.valid) {
      setError(sizeCheck.error ?? "File is too large.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    await runAction("upload", () => uploadMediaAsset({ ownerType: "event", ownerId: event.id, file, originalFilename: file.name }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openTasks = checklist.filter((item) => item.status !== "completed" && item.status !== "cancelled");

  return (
    <Modal open onClose={onClose} title={`Live Event Mode — ${event.title}`}>
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        {error ? (
          <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={busy === "check_in"} onClick={handleCheckIn} className="min-h-11 flex-1 sm:flex-none">
            {busy === "check_in" ? "Checking in…" : "Check In"}
          </Button>
          <Button variant="secondary" disabled={busy === "check_out"} onClick={handleCheckOut} className="min-h-11 flex-1 sm:flex-none">
            {busy === "check_out" ? "Checking out…" : "Check Out"}
          </Button>
          <Button variant="secondary" disabled={busy === "help"} onClick={handleRequestHelp} className="min-h-11 flex-1 sm:flex-none">
            {busy === "help" ? "Requesting…" : "Request Help"}
          </Button>
        </div>

        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Complete Tasks</p>
          {openTasks.length === 0 ? (
            <p className="mt-1.5 text-sm text-text-muted">No open checklist tasks.</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {openTasks.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                  <span className="text-sm text-text">{item.title}</span>
                  <Button variant="ghost" disabled={busy === `task_${item.id}`} onClick={() => handleCompleteTask(item.id)} className="min-h-11 shrink-0">
                    {busy === `task_${item.id}` ? "…" : "Complete"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Upload Photos / Videos</p>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" className="sr-only" id="live_event_media_upload" onChange={(e) => handleFileSelected(e.target.files?.[0])} />
          <Button variant="secondary" disabled={busy === "upload"} onClick={() => fileInputRef.current?.click()} className="mt-1.5 min-h-11">
            {busy === "upload" ? "Uploading…" : "Upload Photo or Video"}
          </Button>
        </section>

        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Add Note</p>
          <Textarea aria-label="Note" value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} placeholder="What's happening on-site?" className="mt-1.5" />
          <Button variant="secondary" disabled={busy === "note" || !noteText.trim()} onClick={handleAddNote} className="mt-1.5 min-h-11">
            Add Note
          </Button>
        </section>

        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Report Issue</p>
          <Textarea aria-label="Issue description" value={issueText} onChange={(e) => setIssueText(e.target.value)} rows={2} placeholder="Describe the issue" className="mt-1.5" />
          <Button variant="secondary" disabled={busy === "issue" || !issueText.trim()} onClick={handleReportIssue} className="mt-1.5 min-h-11">
            Report Issue
          </Button>
        </section>

        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Register Expense</p>
          <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input aria-label="Expense description" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder="Description" className="sm:col-span-2" />
            <Input aria-label="Expense amount in dollars" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="Amount ($)" inputMode="decimal" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select aria-label="Expense category" value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)} className="w-auto">
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {EXPENSE_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
            <Button variant="secondary" disabled={busy === "expense"} onClick={handleRegisterExpense} className="min-h-11">
              {busy === "expense" ? "Saving…" : "Register Expense"}
            </Button>
          </div>
        </section>

        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Event-Day Activity</p>
          {log.length === 0 ? (
            <p className="mt-1.5 text-sm text-text-muted">Nothing logged yet.</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {log.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-2 text-sm">
                  <div>
                    <Badge tone="outline">{LIVE_EVENT_LOG_KIND_LABELS[entry.kind]}</Badge>
                    {entry.note ? <span className="ml-2 text-text-muted">{entry.note}</span> : null}
                  </div>
                  <span className="shrink-0 text-xs text-text-muted">{new Date(entry.occurred_at).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
