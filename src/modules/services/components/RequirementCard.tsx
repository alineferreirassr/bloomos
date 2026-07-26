import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { Tooltip } from "@/components/ui/Tooltip";
import { InventoryIcon, PurchasesIcon, FinanceIcon, TeamIcon, VendorsIcon } from "@/components/ui/icons";

export type RequirementCardVariant = "inventory" | "purchase" | "budget" | "team" | "vendor";

const VARIANT_ICONS: Record<RequirementCardVariant, typeof InventoryIcon> = {
  inventory: InventoryIcon,
  purchase: PurchasesIcon,
  budget: FinanceIcon,
  team: TeamIcon,
  vendor: VendorsIcon,
};

export interface RequirementCardAction {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Explains a persistent disabled state (most commonly a permission denial) — shown via Tooltip on the button itself, never a separate icon or wrapper, so hover/focus land on the actual control. Ignored while `loading` (a transient state needs no explanation). */
  disabledReason?: string;
}

interface RequirementCardProps {
  variant: RequirementCardVariant;
  title: string;
  description?: string;
  /** Already resolved by the caller (label + Badge tone) — this shell never computes what a given requirement TYPE's status should look like; that mapping lives with whichever screen owns the real domain row. */
  status?: { label: string; tone: BadgeTone };
  resolved?: boolean;
  /** A single pre-formatted display value for the row's amount/quantity — e.g. a `<ServicePrice>` element or `"Qty: 4"` — formatting is always the caller's job. */
  detail?: ReactNode;
  primaryAction?: RequirementCardAction;
  secondaryActions?: ActionMenuAction[];
  className?: string;
}

/**
 * One generic shell for all five requirement domain areas (inventory,
 * purchase, budget, team, vendor) — deliberately not five near-identical
 * components, since only the icon and the caller-supplied status/detail
 * differ between them; every other piece of behavior here (resolved
 * styling, primary action states, secondary actions) is identical
 * regardless of variant.
 *
 * Action order is fixed and predictable across every use: header
 * icon+title/description on the left, status badge + ActionMenu on the
 * right; detail value below; the one primary action at the bottom.
 */
export function RequirementCard({
  variant,
  title,
  description,
  status,
  resolved = false,
  detail,
  primaryAction,
  secondaryActions,
  className = "",
}: RequirementCardProps) {
  const Icon = VARIANT_ICONS[variant];

  return (
    <Card className={`${resolved ? "opacity-70" : ""} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
          <div>
            <p className="text-sm font-semibold text-text">{title}</p>
            {description ? <p className="mt-0.5 text-xs text-text-muted">{description}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
          {secondaryActions && secondaryActions.length > 0 ? <ActionMenu actions={secondaryActions} /> : null}
        </div>
      </div>
      {detail ? <div className="mt-2 text-sm text-text">{detail}</div> : null}
      {primaryAction ? <div className="mt-3">{renderPrimaryAction(primaryAction)}</div> : null}
    </Card>
  );
}

function renderPrimaryAction(action: RequirementCardAction) {
  if (action.loading) {
    return (
      <Button type="button" variant="primary" disabled>
        Working…
      </Button>
    );
  }

  if (action.disabled && action.disabledReason) {
    return (
      <Tooltip content={action.disabledReason}>
        <Button
          type="button"
          variant="primary"
          aria-disabled="true"
          onClick={(event) => event.preventDefault()}
          className="cursor-not-allowed opacity-45"
        >
          {action.label}
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button type="button" variant="primary" onClick={action.onClick} disabled={action.disabled}>
      {action.label}
    </Button>
  );
}
