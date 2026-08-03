"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import type { MergeFieldDefinition } from "@/types/documentPlatform";

const DOMAIN_LABELS: Record<MergeFieldDefinition["domain"], string> = {
  workspace: "Workspace",
  crm: "CRM",
  finance: "Finance",
  workflow: "Workflow",
  automation: "Automation",
  memory: "Memory",
  user: "User",
  settings: "Settings",
  lead: "Lead",
  vendor: "Vendor",
  proposal: "Proposal",
  payments: "Payments",
  journey: "Journey",
  brand: "Brand",
  timeline: "Timeline",
};

function groupByDomain(fields: MergeFieldDefinition[]): [MergeFieldDefinition["domain"], MergeFieldDefinition[]][] {
  const groups = new Map<MergeFieldDefinition["domain"], MergeFieldDefinition[]>();
  for (const field of fields) {
    const list = groups.get(field.domain) ?? [];
    list.push(field);
    groups.set(field.domain, list);
  }
  return [...groups.entries()];
}

/**
 * The Editor's own Variables Panel — every registered Merge Field (Step 4),
 * grouped by domain, never hardcoded per document type. Clicking a field
 * copies its own `{{key}}` placeholder to the clipboard rather than
 * inserting directly into a focused input — simpler and more robust than
 * tracking "which of N text inputs across a recursive block tree currently
 * has focus," and the author pastes it exactly where they want it.
 */
export function VariablesPanel({ mergeFields }: { mergeFields: MergeFieldDefinition[] }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copyKey(key: string) {
    const placeholder = `{{${key}}}`;
    try {
      await navigator.clipboard.writeText(placeholder);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500);
    } catch {
      // Clipboard access can be denied by the browser — the placeholder is still visible to copy by hand.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {groupByDomain(mergeFields).map(([domain, fields]) => (
        <div key={domain}>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text/55">{DOMAIN_LABELS[domain]}</h3>
          <ul className="flex flex-col gap-1">
            {fields.map((field) => (
              <li key={field.key}>
                <button
                  type="button"
                  onClick={() => copyKey(field.key)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150 hover:bg-text/7"
                >
                  <span className="flex items-center gap-1.5">
                    <code className="text-xs text-accent">{`{{${field.key}}}`}</code>
                    {field.required ? <Badge tone="outline">Required</Badge> : null}
                    {copiedKey === field.key ? <span className="text-[11px] text-accent">Copied</span> : null}
                  </span>
                  <span className="text-xs text-text/55">{field.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
