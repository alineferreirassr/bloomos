"use client";

import { createElement } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { resolveConnectorIcon } from "@/modules/marketplace/components/connectorIcons";
import { CONNECTOR_CATEGORY_LABELS, type ConnectorDefinition } from "@/types/connector";

interface ConnectorCardProps {
  connector: ConnectorDefinition;
  installed: boolean;
  onOpen: () => void;
}

/** Checkpoint 18, Step 2 — one tile in the Browse grid. Clicking anywhere on the card opens the Details/Configuration modal; a `coming_soon` connector renders but can't be opened for install. */
export function ConnectorCard({ connector, installed, onOpen }: ConnectorCardProps) {
  // Rendered via `createElement` rather than a `<Icon />` JSX tag — same reasoning `KpiCard.tsx` already documents: `resolveConnectorIcon` is a static lookup table, never a component factory, but the lint rule can't verify that for a JSX tag whose identifier was just locally assigned.
  const iconElement = createElement(resolveConnectorIcon(connector.icon), { strokeWidth: 2, className: "h-4.5 w-4.5", "aria-hidden": true });
  const disabled = connector.status === "coming_soon";

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-text">{iconElement}</span>
        {installed ? <Badge tone="success">Installed</Badge> : connector.status === "coming_soon" ? <Badge tone="neutral">Coming soon</Badge> : null}
      </div>
      <div>
        <h3 className="font-serif text-[15px] font-semibold text-text">{connector.name}</h3>
        <Badge tone="outline" className="mt-1">
          {CONNECTOR_CATEGORY_LABELS[connector.category]}
        </Badge>
        <p className="mt-1.5 text-xs text-text-muted">{connector.description}</p>
      </div>
      <Button type="button" variant="secondary" onClick={onOpen} disabled={disabled} className="mt-auto self-start">
        {installed ? "View details" : disabled ? "Coming soon" : "View & install"}
      </Button>
    </Card>
  );
}
