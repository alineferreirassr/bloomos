"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { registerCommand, unregisterCommand } from "@/core/commandPalette";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { ConnectorCard } from "@/modules/marketplace/components/ConnectorCard";
import { ConnectorDetailModal } from "@/modules/marketplace/components/ConnectorDetailModal";
import { InstalledConnectorsTable } from "@/modules/marketplace/components/InstalledConnectorsTable";
import { getMarketplaceData, type MarketplaceData } from "@/modules/marketplace/getMarketplaceData";
import { CONNECTOR_CATEGORY_LABELS, type ConnectorCategory, type ConnectorDefinition } from "@/types/connector";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: MarketplaceData };

/**
 * Checkpoint 18, Step 2/8 — the Marketplace's own top-level view: Browse
 * (search + category filter + install), Installed (lifecycle management),
 * and an Observability strip above both, mirroring the Developer
 * Console's own "one aggregate, always refetched on mutation" discipline
 * so Browse and Installed never drift from each other after an install.
 */
export function MarketplaceView() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ConnectorCategory | "all">("all");
  const [selectedConnector, setSelectedConnector] = useState<ConnectorDefinition | null>(null);

  const load = () => {
    getMarketplaceData().then((result) => {
      if (!result.success) {
        setState({ status: "error", message: result.error });
        return;
      }
      setState({ status: "ready", data: result.data });
    });
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    registerCommand({ id: "open-marketplace", label: "Open Marketplace", group: "Marketplace", keywords: ["marketplace", "connectors", "integrations", "apps"], run: () => router.push("/marketplace") });
    return () => unregisterCommand("open-marketplace");
  }, [router]);

  const installedConnectorIds = useMemo(() => {
    if (state.status !== "ready") return new Set<string>();
    return new Set(state.data.installations.map((installation) => installation.connector_id));
  }, [state]);

  const filteredCatalog = useMemo(() => {
    if (state.status !== "ready") return [];
    const query = search.trim().toLowerCase();
    return state.data.catalog.filter((connector) => {
      if (category !== "all" && connector.category !== category) return false;
      if (!query) return true;
      return connector.name.toLowerCase().includes(query) || connector.description.toLowerCase().includes(query);
    });
  }, [state, search, category]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message={state.message} onRetry={load} />;
  }

  const { data } = state;
  const observabilityCards: { label: string; value: string }[] = [
    { label: "Installed", value: data.observability.installationCount.toLocaleString() },
    { label: "Failures", value: data.observability.failureCount.toLocaleString() },
    { label: "Connected", value: data.observability.byHealth.connected.toLocaleString() },
    { label: "Reconnects", value: data.observability.totalReconnects.toLocaleString() },
    { label: "Webhook deliveries", value: data.observability.webhookUsage.totalDeliveries.toLocaleString() },
    { label: "API requests", value: data.observability.apiUsage.totalRequests.toLocaleString() },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Marketplace" subtitle="Connect BloomOS to third-party services through the Public API and Webhooks." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {observabilityCards.map((item) => (
          <Card key={item.label}>
            <p className="text-xs text-text-muted">{item.label}</p>
            <p className="mt-1 font-serif text-2xl font-semibold text-text">{item.value}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="browse">
        <TabList aria-label="Marketplace">
          <Tab value="browse">Browse</Tab>
          <Tab value="installed">Installed ({data.installations.length})</Tab>
        </TabList>

        <TabPanel value="browse">
          <div className="mt-4 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search connectors…" className="sm:max-w-xs" aria-label="Search connectors" />
              <Select value={category} onChange={(event) => setCategory(event.target.value as ConnectorCategory | "all")} className="sm:max-w-[220px]" aria-label="Filter by category">
                <option value="all">All categories</option>
                {Object.entries(CONNECTOR_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            {filteredCatalog.length === 0 ? (
              <EmptyState title="No connectors match" description="Try a different search term or category." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCatalog.map((connector) => (
                  <ConnectorCard key={connector.id} connector={connector} installed={installedConnectorIds.has(connector.id)} onOpen={() => setSelectedConnector(connector)} />
                ))}
              </div>
            )}
          </div>
        </TabPanel>

        <TabPanel value="installed">
          <div className="mt-4">
            <InstalledConnectorsTable installations={data.installations} catalog={data.catalog} onChanged={load} />
          </div>
        </TabPanel>
      </Tabs>

      {selectedConnector ? (
        <ConnectorDetailModal
          connector={selectedConnector}
          alreadyInstalled={installedConnectorIds.has(selectedConnector.id)}
          onClose={() => setSelectedConnector(null)}
          onInstalled={() => {
            setSelectedConnector(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}
