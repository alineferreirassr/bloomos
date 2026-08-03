"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { SettingsDashboardData } from "@/modules/settings/getSettingsDashboardData";
import type { UpdateSettingActionResult } from "@/modules/settings/updateSettingAction";
import type { SettingValue } from "@/types/settings";

interface SettingsDashboardPanelProps {
  data: SettingsDashboardData;
  onApplyRecommendation: (settingId: string, value: SettingValue) => Promise<UpdateSettingActionResult>;
  onNavigateToSection: (sectionId: string) => void;
}

function formatValue(value: SettingValue): string {
  if (value === null) return "—";
  if (typeof value === "boolean") return value ? "On" : "Off";
  return String(value);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * The Step 15 Settings Dashboard — an at-a-glance oversight panel that sits
 * above the Section nav on the Settings page itself (Settings has no
 * separate top-level route the way Automation/Workflow do). Recommended
 * Configurations render Bloom AI's own deterministic suggestions
 * (`core/settings/recommendations.ts`) with an explicit "Apply" control —
 * Step 16's own "must NEVER apply them automatically" — every apply here
 * routes through the exact same `updateSettingAction` a manual edit uses,
 * never a privileged bypass path.
 */
export function SettingsDashboardPanel({ data, onApplyRecommendation, onNavigateToSection }: SettingsDashboardPanelProps) {
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  async function apply(settingId: string, value: SettingValue) {
    setApplyingId(settingId);
    await onApplyRecommendation(settingId, value);
    setApplyingId(null);
    setDismissedIds((prev) => new Set(prev).add(settingId));
  }

  const visibleRecommendations = data.recommendations.filter((rec) => !dismissedIds.has(rec.settingId));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-sm font-semibold text-text">Workspace Health</h2>
          <Badge tone={data.health.healthPercent >= 90 ? "success" : data.health.healthPercent >= 60 ? "warning" : "danger"}>{data.health.healthPercent}%</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text/55">Settings</dt>
            <dd className="mt-0.5 font-serif text-lg font-semibold text-text">{data.health.totalSettings}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text/55">Warnings</dt>
            <dd className="mt-0.5 font-serif text-lg font-semibold text-text">{data.health.settingsWithWarnings}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text/55">Missing</dt>
            <dd className="mt-0.5 font-serif text-lg font-semibold text-text">{data.health.missingRequiredCount}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="font-serif text-sm font-semibold text-text">Recently Changed</h2>
        {data.recentChanges.length === 0 ? (
          <p className="mt-2 text-xs text-text/55">No changes yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.recentChanges.slice(0, 5).map((change) => (
              <li key={change.id} className="text-xs">
                <button type="button" onClick={() => onNavigateToSection(change.sectionId)} disabled={!change.sectionId} className="font-medium text-text hover:underline disabled:no-underline disabled:opacity-70">
                  {change.settingLabel}
                </button>
                <span className="text-text/55">
                  {" "}
                  → {formatValue(change.newValue)} · {formatDateTime(change.changedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-serif text-sm font-semibold text-text">Warnings &amp; Missing Configuration</h2>
        {data.warnings.length === 0 ? (
          <p className="mt-2 text-xs text-text/55">Nothing needs attention.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.warnings.map((issue) => (
              <li key={`${issue.settingId}-${issue.code}`} className="flex items-start gap-2 text-xs">
                <Badge tone={issue.code === "required_missing" ? "danger" : "warning"}>{issue.code === "required_missing" ? "Missing" : "Warning"}</Badge>
                <span className="text-text/70">{issue.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-serif text-sm font-semibold text-text">Recommended Configurations</h2>
        {visibleRecommendations.length === 0 ? (
          <p className="mt-2 text-xs text-text/55">No recommendations right now.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {visibleRecommendations.map((rec) => (
              <li key={rec.settingId} className="flex flex-col gap-1.5 border-b border-border/60 pb-3 text-xs last:border-b-0 last:pb-0">
                <p className="text-text/70">{rec.reason}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text/55">
                    {formatValue(rec.currentValue)} → <span className="font-medium text-text">{formatValue(rec.recommendedValue)}</span>
                  </span>
                  <div className="flex gap-1.5">
                    <Button type="button" variant="ghost" onClick={() => setDismissedIds((prev) => new Set(prev).add(rec.settingId))}>
                      Dismiss
                    </Button>
                    <Button type="button" onClick={() => apply(rec.settingId, rec.recommendedValue)} disabled={applyingId === rec.settingId}>
                      {applyingId === rec.settingId ? "Applying…" : "Apply"}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
