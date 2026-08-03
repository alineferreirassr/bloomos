"use client";

import { Card } from "@/components/ui/Card";
import { RequirementCard } from "@/modules/services/components/RequirementCard";
import { useFulfillEventServiceInventoryRequirement } from "@/modules/services/hooks/useEventServiceRequirementMutations";
import { useServicesPermissions } from "@/modules/services/hooks/useServicesPermissions";
import { canOverrideEventService, type EventServiceStatus } from "@/core/workflows/eventServiceWorkflow";
import type { EventServiceInventoryRequirement } from "@/types/eventServiceInventoryRequirement";

interface InventorySectionProps {
  eventServiceId: string;
  status: EventServiceStatus;
  inventory: EventServiceInventoryRequirement[];
}

/**
 * "Do not create a full inventory module here" — no InventoryItem lookup,
 * no stock movements, no navigation into `/inventory`. This only reuses the
 * one mutation that already exists for this exact requirement type
 * (`useFulfillEventServiceInventoryRequirement`, built in Checkpoint 1.5) —
 * `is_fulfilled` is a manually-set human flag, never derived from real
 * Inventory stock, so "fulfilled" here means "someone confirmed this is
 * ready," not "the warehouse allocated it."
 */
export function InventorySection({ eventServiceId, status, inventory }: InventorySectionProps) {
  const fulfill = useFulfillEventServiceInventoryRequirement(eventServiceId);
  const { canChangeStatus, disabledReason } = useServicesPermissions();
  const editable = canOverrideEventService(status);

  if (inventory.length === 0) {
    return (
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Inventory</h3>
        <p className="mt-2 text-sm text-text-muted">No inventory required for this assignment.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-serif text-[17px] font-semibold text-text">Inventory</h3>
      {inventory.map((requirement) => (
        <RequirementCard
          key={requirement.id}
          variant="inventory"
          title={requirement.item_name}
          detail={`Qty: ${requirement.quantity}`}
          resolved={requirement.is_fulfilled}
          status={{ label: requirement.is_fulfilled ? "Fulfilled" : "Needed", tone: requirement.is_fulfilled ? "success" : "outline" }}
          primaryAction={
            requirement.is_fulfilled || !editable
              ? undefined
              : {
                  label: "Mark fulfilled",
                  onClick: () => fulfill.mutate(requirement.id),
                  loading: fulfill.isPending && fulfill.variables === requirement.id,
                  disabled: !canChangeStatus,
                  disabledReason: disabledReason ?? undefined,
                }
          }
        />
      ))}
    </div>
  );
}
