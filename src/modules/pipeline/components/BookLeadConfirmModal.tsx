"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { bookLead, getClientsWithPendingRecovery, type BookLeadInput } from "@/lib/data";
import { EVENT_TYPES, EVENT_TYPE_LABELS, type EventType } from "@/core/enums/eventType";
import type { Lead } from "@/types/lead";
import type { Client } from "@/types/client";

interface BookLeadConfirmModalProps {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  onBooked: (leadId: string) => void;
  /** Fired instead of onBooked when conversion succeeded but Event creation didn't — the Lead still leaves the board, but the caller shows a persistent recoverable alert instead of a plain success message. */
  onPendingRecovery: (leadId: string, client: Client) => void;
}

function guessEventType(lead: Lead): EventType | "" {
  const match = EVENT_TYPES.find((t) => t === lead.event_type);
  return match ?? "";
}

export function BookLeadConfirmModal({ lead, open, onClose, onBooked, onPendingRecovery }: BookLeadConfirmModalProps) {
  const [title, setTitle] = useState(() => `${lead.first_name} ${lead.last_name}'s Event`);
  const [eventType, setEventType] = useState<EventType | "">(() => guessEventType(lead));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!eventType) {
      setError("Choose an event type before booking.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const input: BookLeadInput = {
      title,
      event_type: eventType,
      event_date: lead.event_date ?? "",
      start_time: "",
      end_time: "",
      timezone: "",
      location_name: lead.location ?? "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      latitude: "",
      longitude: "",
      guest_count: "",
      budget_min: lead.budget_min === null ? "" : String(lead.budget_min),
      budget_max: lead.budget_max === null ? "" : String(lead.budget_max),
      package_name: "",
      theme: "",
      color_palette: "",
      surprise_event: false,
      confidentiality_notes: "",
      accessibility_notes: "",
      dietary_notes: "",
      weather_plan: "",
      backup_location: "",
      internal_summary: "",
      assigned_owner: lead.assigned_to ?? "",
      priority: "normal",
    };

    const result = await bookLead(lead.id, input);
    setSubmitting(false);

    if (result.success) {
      onBooked(lead.id);
      onClose();
      return;
    }

    // bookLead's own DataResult has no structured flag for "this failure left
    // a recoverable Client" — check the durable state directly rather than
    // string-matching the error message.
    const recoveryClients = await getClientsWithPendingRecovery("booking");
    const recoveryClient = recoveryClients.find((c) => c.originating_lead_id === lead.id);
    if (recoveryClient) {
      onPendingRecovery(lead.id, recoveryClient);
      onClose();
      return;
    }

    setError(result.error);
  };

  return (
    <Modal open={open} onClose={onClose} title="Book Lead">
      <p className="text-sm text-text-muted">
        This converts <strong className="text-text">{lead.first_name} {lead.last_name}</strong> to a Client
        (reusing an existing Client by email if one already exists) and creates a linked Event, starting it in
        the Planning stage.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">Event title</span>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} disabled={submitting} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-muted">Event type</span>
          <Select
            value={eventType}
            onChange={(event) => setEventType(event.target.value as EventType)}
            disabled={submitting}
          >
            <option value="">Select an event type…</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {EVENT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Booking…" : "Book Lead"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
