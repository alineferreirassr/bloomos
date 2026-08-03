"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/forms/FormField";
import type { WebhookEventDefinition, WebhookEventType } from "@/types/webhookEvent";
import type { WebhookEndpointWithSecret, CreateWebhookEndpointInput } from "@/types/webhookEndpoint";
import type { ManageWebhookEndpointsResult } from "@/modules/webhooks/manageWebhookEndpointsActions";

interface CreateWebhookEndpointModalProps {
  open: boolean;
  onClose: () => void;
  catalog: WebhookEventDefinition[];
  onCreate: (input: CreateWebhookEndpointInput) => Promise<ManageWebhookEndpointsResult<WebhookEndpointWithSecret>>;
  onCreated: (result: WebhookEndpointWithSecret) => void;
}

/** Checkpoint 17, Step 2 — the Developer Console's "New Webhook" form, mirroring `CreateApiKeyModal.tsx`'s exact shape: a text field plus a checkbox list, grouped by category so 17 events don't read as one undifferentiated wall. */
export function CreateWebhookEndpointModal({ open, onClose, catalog, onCreate, onCreated }: CreateWebhookEndpointModalProps) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<WebhookEventType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleEvent = (type: WebhookEventType) => {
    setEvents((current) => (current.includes(type) ? current.filter((t) => t !== type) : [...current, type]));
  };

  const byCategory = new Map<string, WebhookEventDefinition[]>();
  for (const definition of catalog) {
    const list = byCategory.get(definition.category) ?? [];
    list.push(definition);
    byCategory.set(definition.category, list);
  }

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await onCreate({ url, description, subscribed_events: events });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setUrl("");
    setDescription("");
    setEvents([]);
    onClose();
    onCreated(result.data);
  };

  return (
    <Modal open={open} onClose={onClose} title="New Webhook">
      <div className="space-y-4">
        {error ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        <FormField label="URL" htmlFor="webhook_url_input" required>
          <Input id="webhook_url_input" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/webhooks/bloomos" />
        </FormField>
        <FormField label="Description" htmlFor="webhook_description_input">
          <Input id="webhook_description_input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Order fulfillment system" />
        </FormField>
        <fieldset className="max-h-64 space-y-4 overflow-y-auto">
          <legend className="text-xs font-medium text-text">Events</legend>
          {[...byCategory.entries()].map(([category, definitions]) => (
            <div key={category} className="space-y-1.5">
              <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">{category}</p>
              {definitions.map((definition) => (
                <label key={definition.type} className="flex items-start gap-2 text-sm text-text">
                  <Checkbox checked={events.includes(definition.type)} onChange={() => toggleEvent(definition.type)} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{definition.type}</span>
                    <span className="block text-xs text-text-muted">{definition.description}</span>
                  </span>
                </label>
              ))}
            </div>
          ))}
        </fieldset>
        <div className="flex items-center gap-3 pt-1">
          <Button onClick={submit} disabled={submitting || url.trim().length === 0 || events.length === 0}>
            {submitting ? "Creating…" : "Create Webhook"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
