"use client";

import { useState, type FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/forms/FormField";
import { formatMoney, majorToMinor, minorToMajor } from "@/lib/money";
import { canOverrideEventService } from "@/core/workflows/eventServiceWorkflow";
import { useUpdateEventServiceOverrides } from "@/modules/services/hooks/useEventServiceOverrideMutations";
import type { EventService } from "@/types/eventService";

interface AssignmentOverridesCardProps {
  eventService: EventService;
  serviceId: string;
}

/**
 * The one place an Event Assignment stops being purely read-only — but
 * still only ever calls the existing `useUpdateEventServiceOverrides`
 * mutation, never a second override-writing path. Renders straight off
 * `eventService`'s own `name`/`name_template_value`/`price_minor`/
 * `price_template_value` fields — no separate fetch, since those live on
 * the row this card already received.
 */
export function AssignmentOverridesCard({ eventService, serviceId }: AssignmentOverridesCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(eventService.name);
  const [priceMajor, setPriceMajor] = useState(String(minorToMajor(eventService.price_minor)));
  const mutation = useUpdateEventServiceOverrides(eventService.id, undefined, serviceId);
  const canEdit = canOverrideEventService(eventService.status);

  const isNameOverridden = eventService.name !== eventService.name_template_value;
  const isPriceOverridden = eventService.price_minor !== eventService.price_template_value;

  function startEditing() {
    setName(eventService.name);
    setPriceMajor(String(minorToMajor(eventService.price_minor)));
    setEditing(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await mutation.mutateAsync({ name, price_minor: majorToMinor(Number(priceMajor) || 0) });
    setEditing(false);
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-[17px] font-semibold text-text">Overrides</h3>
        {!editing && canEdit ? (
          <Button type="button" variant="secondary" onClick={startEditing}>
            Edit
          </Button>
        ) : null}
      </div>
      {!canEdit ? <p className="mt-1 text-xs text-text-muted">This assignment&apos;s status no longer allows overrides.</p> : null}

      {editing ? (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <FormField label="Name" htmlFor="assignment_override_name">
            <Input id="assignment_override_name" value={name} onChange={(event) => setName(event.target.value)} required />
          </FormField>
          <FormField label="Price" htmlFor="assignment_override_price" hint={`Template price: ${formatMoney(eventService.price_template_value, eventService.currency)}`}>
            <Input
              id="assignment_override_price"
              type="number"
              step="0.01"
              min="0"
              value={priceMajor}
              onChange={(event) => setPriceMajor(event.target.value)}
            />
          </FormField>
          {mutation.isError ? (
            <p role="alert" className="text-xs text-danger">
              Couldn&apos;t save — please try again.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-text-muted">Name{isNameOverridden ? " (overridden)" : ""}</dt>
            <dd className="text-text">{eventService.name}</dd>
            {isNameOverridden ? <dd className="text-xs text-text-muted">Template: {eventService.name_template_value}</dd> : null}
          </div>
          <div>
            <dt className="text-xs text-text-muted">Price{isPriceOverridden ? " (overridden)" : ""}</dt>
            <dd className="text-text">{formatMoney(eventService.price_minor, eventService.currency)}</dd>
            {isPriceOverridden ? <dd className="text-xs text-text-muted">Template: {formatMoney(eventService.price_template_value, eventService.currency)}</dd> : null}
          </div>
        </dl>
      )}
    </Card>
  );
}
