"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ConvertToClientModal } from "@/modules/leads/components/ConvertToClientModal";
import { archiveLead, markWelcomeGuideSent } from "@/lib/data";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import type { Lead } from "@/types/lead";
import type { Client } from "@/types/client";

interface LeadActionsProps {
  lead: Lead;
  onChanged: () => void;
  onConverted: (lead: Lead, client: Client) => void;
}

export function LeadActions({ lead, onChanged, onConverted }: LeadActionsProps) {
  const { can } = useMemberSession();
  const canUpdate = can("leads.update");
  const canArchive = can("leads.archive");
  // Converting creates a new Client record in addition to updating the Lead.
  const canConvert = canUpdate && can("clients.create");
  const [convertOpen, setConvertOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"welcome_guide" | "archive" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isConverted = lead.status === "converted";
  const isArchived = lead.status === "archived";

  const handleWelcomeGuide = async () => {
    setPendingAction("welcome_guide");
    setError(null);
    setFeedback(null);
    const result = await markWelcomeGuideSent(lead.id);
    setPendingAction(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setFeedback("Welcome Guide marked as sent.");
    onChanged();
  };

  const handleArchive = async () => {
    setPendingAction("archive");
    setError(null);
    setFeedback(null);
    const result = await archiveLead(lead.id);
    setPendingAction(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onChanged();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {!isConverted && canUpdate ? (
          <Link href={`/leads/${lead.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        ) : null}
        {!isConverted && !isArchived && canUpdate ? (
          <Button
            variant="secondary"
            onClick={handleWelcomeGuide}
            disabled={pendingAction === "welcome_guide"}
          >
            {pendingAction === "welcome_guide" ? "Sending…" : "Mark Welcome Guide as Sent"}
          </Button>
        ) : null}
        {!isConverted && !isArchived && canArchive ? (
          <Button
            variant="secondary"
            onClick={handleArchive}
            disabled={pendingAction === "archive"}
          >
            {pendingAction === "archive" ? "Archiving…" : "Archive"}
          </Button>
        ) : null}
        {!isConverted && canConvert ? (
          <Button onClick={() => setConvertOpen(true)}>Convert to Client</Button>
        ) : lead.converted_client_id ? (
          <Link href={`/clients/${lead.converted_client_id}`}>
            <Button variant="secondary">View Client</Button>
          </Link>
        ) : null}
      </div>

      {feedback ? <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{feedback}</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

      <ConvertToClientModal
        lead={lead}
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConverted={onConverted}
      />
    </div>
  );
}
