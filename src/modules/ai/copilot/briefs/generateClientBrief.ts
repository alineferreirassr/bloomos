import { getClientPortalOverview, getClientPortalContracts, getClientPortalChecklist } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import type { BriefLine, ClientBrief } from "@/modules/ai/copilot/briefs/types";

/**
 * Checkpoint 20, Step 6 — the Client Brief. Almost entirely a re-narration
 * of `ClientPortalOverview` (already built in Checkpoint 19/14) plus the
 * Portal's own checklist/contract reads — deterministic, no LLM, matching
 * the same spirit `generateExecutiveBrief.ts` follows for Step 4. There is
 * no distinct "meeting" entity in this domain model — the Event itself
 * *is* the meeting a Client Brief would reference, so "Upcoming meeting"
 * narrates the Event's own date/time rather than a fabricated second
 * concept.
 */
export async function generateClientBrief(): Promise<ClientBrief> {
  const [overview, contracts, checklist] = await Promise.all([
    getClientPortalOverview(),
    getClientPortalContracts(),
    getClientPortalChecklist(),
  ]);

  const now = Date.now();
  const daysUntilEvent = overview.upcomingEvent?.event_date
    ? Math.ceil((new Date(overview.upcomingEvent.event_date).getTime() - now) / (24 * 60 * 60 * 1000))
    : null;

  const unsignedContract = contracts.find((contract) => contract.signature_status === "unsigned" || contract.signature_status === "sent");
  const completed = checklist.filter((item) => item.status === "completed").length;

  const lines: BriefLine[] = [];

  if (daysUntilEvent !== null && overview.upcomingEvent) {
    lines.push({
      id: "days-until-event",
      text:
        daysUntilEvent > 0
          ? `${daysUntilEvent} day${daysUntilEvent === 1 ? "" : "s"} until ${overview.upcomingEvent.title}.`
          : `${overview.upcomingEvent.title} is today.`,
      tone: "info",
    });
  }

  if (overview.nextPaymentDue) {
    lines.push({
      id: "pending-payment",
      text: `A payment of ${formatMoney(overview.nextPaymentDue.balanceMinor, overview.currency)} is due${overview.nextPaymentDue.dueDate ? ` on ${overview.nextPaymentDue.dueDate}` : ""}.`,
      tone: "warning",
    });
  } else {
    lines.push({ id: "pending-payment", text: "No payments currently due.", tone: "success" });
  }

  if (unsignedContract) {
    lines.push({
      id: "pending-signature",
      text: `${unsignedContract.title} is waiting on your signature.`,
      tone: "warning",
    });
  }

  if (checklist.length > 0) {
    lines.push({
      id: "checklist-progress",
      text: `Checklist progress: ${completed}/${checklist.length} complete.`,
      tone: "info",
    });
  }

  if (overview.upcomingEvent?.event_date) {
    lines.push({
      id: "upcoming-meeting",
      text: `${overview.upcomingEvent.title} is scheduled for ${overview.upcomingEvent.event_date}${overview.upcomingEvent.start_time ? ` at ${overview.upcomingEvent.start_time}` : ""}.`,
      tone: "info",
    });
  }

  return {
    greeting: `Welcome back, ${overview.clientName}.`,
    summary: overview.upcomingEvent ? `Here's where things stand for ${overview.upcomingEvent.title}.` : "Here's where things stand.",
    lines,
    nextStep: overview.nextRecommendedAction,
    generatedAt: new Date().toISOString(),
  };
}
