"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Toast } from "@/components/ui/Toast";
import { registerCommand, unregisterCommand } from "@/core/commandPalette";
import { getSettingsPageData, type SettingsPageData } from "@/modules/settings/getSettingsPageData";
import { getSettingsDashboardData, type SettingsDashboardData } from "@/modules/settings/getSettingsDashboardData";
import { updateSettingAction } from "@/modules/settings/updateSettingAction";
import { SettingsSectionNav } from "@/modules/settings/components/SettingsSectionNav";
import { SettingsSearchBox } from "@/modules/settings/components/SettingsSearchBox";
import { SettingField } from "@/modules/settings/components/SettingField";
import { SettingsDashboardPanel } from "@/modules/settings/components/SettingsDashboardPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import type { SettingValue } from "@/types/settings";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: SettingsPageData };
type DashboardLoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: SettingsDashboardData };

async function load(): Promise<LoadState> {
  const result = await getSettingsPageData();
  if (!result.success) return { status: "error", message: result.error };
  return { status: "ready", data: result.data };
}

async function loadDashboard(): Promise<DashboardLoadState> {
  const result = await getSettingsDashboardData();
  if (!result.success) return { status: "error" };
  return { status: "ready", data: result.data };
}

/**
 * The Enterprise Settings Platform's own page — Section nav on the left,
 * Global Search up top, the active Section's Settings rendered generically
 * on the right. This component itself never names a specific Section or
 * Setting: it walks `data.sections`/`data.settingsBySection`, exactly the
 * "no hardcoded module-specific logic" success criterion this checkpoint
 * spec calls for. A future module's Settings appear here the moment its own
 * section file registers — this file doesn't change.
 */
export function SettingsView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [dashboardState, setDashboardState] = useState<DashboardLoadState>({ status: "loading" });
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, SettingValue>>({});
  const [toast, setToast] = useState<string | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  // Step 17 — "Add: Open Settings, Search Settings, Developer Settings,
  // Security Settings, AI Settings." Self-registers into the Command
  // Palette registry the same way `AutomationDashboardView` does — each
  // command targets a real, already-rendered part of this page (a section
  // id or the search box), never a hardcoded switch on which Setting lives
  // where.
  useEffect(() => {
    registerCommand({
      id: "open-settings",
      label: "Open Settings",
      group: "Settings",
      keywords: ["settings", "configuration", "preferences"],
      run: () => {
        headingRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        headingRef.current?.focus();
      },
    });
    registerCommand({
      id: "search-settings",
      label: "Search Settings",
      group: "Settings",
      keywords: ["settings", "search", "find"],
      run: () => document.getElementById("settings-global-search")?.focus(),
    });
    registerCommand({
      id: "ai-settings",
      label: "AI Settings",
      group: "Settings",
      keywords: ["settings", "ai", "provider"],
      run: () => setActiveSectionId("ai"),
    });
    registerCommand({
      id: "security-settings",
      label: "Security Settings",
      group: "Settings",
      keywords: ["settings", "security", "mfa"],
      run: () => setActiveSectionId("security"),
    });
    registerCommand({
      id: "developer-settings",
      label: "Developer Settings",
      group: "Settings",
      keywords: ["settings", "developer", "feature flags"],
      run: () => setActiveSectionId("developer"),
    });
    return () => {
      unregisterCommand("open-settings");
      unregisterCommand("search-settings");
      unregisterCommand("ai-settings");
      unregisterCommand("security-settings");
      unregisterCommand("developer-settings");
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().then((next) => {
      if (cancelled) return;
      setState(next);
      if (next.status === "ready") {
        setValues(next.data.values);
        setActiveSectionId((current) => current ?? next.data.sections[0]?.id ?? null);
      }
    });
    loadDashboard().then((next) => {
      if (!cancelled) setDashboardState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(settingId: string, value: SettingValue) {
    const result = await updateSettingAction(settingId, value);
    if (result.success) {
      setValues((prev) => ({ ...prev, [settingId]: value }));
      loadDashboard().then(setDashboardState);
    } else {
      setToast(result.issues[0]?.message ?? "That value couldn't be saved.");
    }
    return result;
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full max-w-xs" />
        <div className="flex gap-6">
          <Skeleton className="h-64 w-56 shrink-0" />
          <Skeleton className="h-96 flex-1" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message={state.message} onRetry={() => { setState({ status: "loading" }); load().then(setState); }} />;
  }

  const { data } = state;
  const activeSection = data.sections.find((section) => section.id === activeSectionId) ?? data.sections[0] ?? null;
  const activeSettings = activeSection ? (data.settingsBySection[activeSection.id] ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      <div ref={headingRef} tabIndex={-1} className="focus:outline-none">
        <PageHeader title="Settings" subtitle="The configuration center for every BloomOS module." />
      </div>

      {dashboardState.status === "ready" ? (
        <SettingsDashboardPanel data={dashboardState.data} onApplyRecommendation={handleSave} onNavigateToSection={setActiveSectionId} />
      ) : dashboardState.status === "loading" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : null}

      <SettingsSearchBox onNavigate={setActiveSectionId} />

      {data.sections.length === 0 ? (
        <ErrorState message="No settings are visible to your role yet." />
      ) : (
        <div className="flex flex-col gap-6 sm:flex-row">
          <SettingsSectionNav sections={data.sections} activeSectionId={activeSection?.id ?? ""} onSelect={setActiveSectionId} />

          <Card className="min-w-0 flex-1">
            {activeSection ? (
              <>
                <h2 className="font-serif text-base font-semibold text-text">{activeSection.label}</h2>
                <p className="mt-0.5 text-xs text-text/55">{activeSection.description}</p>
                {activeSettings.length === 0 ? (
                  <p className="mt-4 text-sm text-text/55">This section has no configurable settings yet.</p>
                ) : (
                  <div className="mt-2">
                    {activeSettings.map((setting) => (
                      <SettingField key={setting.id} setting={setting} value={values[setting.id] ?? setting.defaultValue} onSave={handleSave} />
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </Card>
        </div>
      )}

      {toast ? <Toast tone="danger" message={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
