"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/forms/FormField";
import type { ConnectorConfigField } from "@/types/connector";
import type { ConnectorConfigValue } from "@/types/connectorInstallation";

interface ConnectorConfigFormProps {
  idPrefix: string;
  configSchema: ConnectorConfigField[];
  values: Record<string, ConnectorConfigValue>;
  onChange: (key: string, value: ConnectorConfigValue) => void;
}

/**
 * Checkpoint 18, Step 2/3 — the Marketplace's own generic Configuration
 * renderer: switches on `field.type` (a closed 4-value enum), never on
 * `field.key` — the same "one generic renderer over a declared schema"
 * discipline `SettingField.tsx` (Checkpoint 11) already established, so a
 * 13th connector's own `configSchema` renders correctly the instant it's
 * registered, with zero changes to this file.
 */
export function ConnectorConfigForm({ idPrefix, configSchema, values, onChange }: ConnectorConfigFormProps) {
  if (configSchema.length === 0) {
    return <p className="text-xs text-text-muted">This connector has no configuration options.</p>;
  }

  return (
    <div className="space-y-4">
      {configSchema.map((field) => {
        const fieldId = `${idPrefix}-${field.key}`;
        const value = values[field.key];

        if (field.type === "boolean") {
          return (
            <label key={field.key} htmlFor={fieldId} className="flex items-center gap-2 text-sm text-text">
              <Checkbox id={fieldId} checked={Boolean(value)} onChange={(event) => onChange(field.key, event.target.checked)} />
              {field.label}
            </label>
          );
        }

        return (
          <FormField key={field.key} label={field.label} htmlFor={fieldId} required={field.required} hint={field.helpText}>
            {field.type === "select" ? (
              <Select id={fieldId} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(field.key, event.target.value)}>
                <option value="" disabled>
                  Select…
                </option>
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id={fieldId}
                type={field.type === "url" ? "url" : "text"}
                value={typeof value === "string" ? value : ""}
                placeholder={field.placeholder}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}
          </FormField>
        );
      })}
    </div>
  );
}
