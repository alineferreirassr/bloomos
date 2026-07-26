"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { ServiceStatusBadge } from "@/modules/services/components/ServiceStatusBadge";
import { VersionBadge } from "@/modules/services/components/VersionBadge";
import { ServiceUsageCount } from "@/modules/services/components/ServiceUsageCount";
import { canPublishServiceVersion, canTransitionServiceStatus } from "@/core/workflows/serviceWorkflow";
import type { ServicesPermissions } from "@/modules/services/hooks/useServicesPermissions";
import type { Service } from "@/types/service";
import type { ServiceVersion } from "@/types/serviceVersion";

interface ServiceDetailHeaderProps {
  service: Service;
  categoryName: string | null;
  draftVersion: ServiceVersion;
  publishedVersion: ServiceVersion | null;
  usageCount: number;
  permissions: ServicesPermissions;
  onEditIdentity: () => void;
  onOpenPublish: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  activatePending: boolean;
  deactivatePending: boolean;
  archivePending: boolean;
  restorePending: boolean;
}

/**
 * Name/category/status/version badges/usage count plus the three primary
 * actions the spec names (Edit identity, Publish, Activate-or-Deactivate),
 * with Archive/Restore in a secondary ActionMenu. "Edit identity" jumps the
 * page to the Overview tab and scrolls the Identity card into view rather
 * than remote-controlling that form's own edit-mode state — it owns that
 * state itself (see ServiceIdentityForm), so this stays a navigation
 * shortcut, not a second source of truth for whether it's editing.
 */
export function ServiceDetailHeader({
  service,
  categoryName,
  draftVersion,
  publishedVersion,
  usageCount,
  permissions,
  onEditIdentity,
  onOpenPublish,
  onActivate,
  onDeactivate,
  onArchive,
  onRestore,
  activatePending,
  deactivatePending,
  archivePending,
  restorePending,
}: ServiceDetailHeaderProps) {
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const isArchived = service.status === "archived";

  const publishBlockingReason = canPublishServiceVersion(draftVersion);
  const publishDisabledReason = isArchived
    ? "Archived Services can't publish a new version."
    : !permissions.canPublish
      ? permissions.disabledReason
      : publishBlockingReason;
  const canPublish = !publishDisabledReason;

  const canGoActive = !isArchived && canTransitionServiceStatus(service.status, "active");
  const canGoInactive = !isArchived && canTransitionServiceStatus(service.status, "inactive");
  const statusActionDisabledReason = permissions.canChangeStatus ? undefined : permissions.disabledReason;

  const secondaryActions: ActionMenuAction[] = [];
  if (!isArchived) {
    secondaryActions.push({ label: "Archive", onSelect: () => setConfirmingArchive(true), destructive: true });
  } else {
    secondaryActions.push({ label: restorePending ? "Restoring…" : "Restore", onSelect: onRestore });
  }

  return (
    <div className="space-y-3 border-b border-border bg-surface pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-2xl font-semibold text-text">{service.name}</h1>
            <ServiceStatusBadge status={service.status} />
          </div>
          <p className="mt-1 text-sm text-text-muted">{categoryName ?? "No category"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {publishedVersion ? <VersionBadge status={publishedVersion.status} versionNumber={publishedVersion.version_number} isCurrent /> : null}
            <VersionBadge status={draftVersion.status} versionNumber={draftVersion.version_number} />
            <ServiceUsageCount count={usageCount} className="text-sm text-text-muted" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={onEditIdentity}>
            Edit identity
          </Button>

          {canPublish ? (
            <Button type="button" onClick={onOpenPublish}>
              Publish
            </Button>
          ) : (
            <Tooltip content={publishDisabledReason ?? ""}>
              <Button type="button" aria-disabled="true" onClick={(event) => event.preventDefault()} className="cursor-not-allowed opacity-45">
                Publish
              </Button>
            </Tooltip>
          )}

          {canGoActive ? (
            statusActionDisabledReason ? (
              <Tooltip content={statusActionDisabledReason}>
                <Button type="button" variant="secondary" aria-disabled="true" onClick={(event) => event.preventDefault()} className="cursor-not-allowed opacity-45">
                  Activate
                </Button>
              </Tooltip>
            ) : (
              <Button type="button" variant="secondary" onClick={onActivate} disabled={activatePending}>
                {activatePending ? "Activating…" : "Activate"}
              </Button>
            )
          ) : canGoInactive ? (
            statusActionDisabledReason ? (
              <Tooltip content={statusActionDisabledReason}>
                <Button type="button" variant="secondary" aria-disabled="true" onClick={(event) => event.preventDefault()} className="cursor-not-allowed opacity-45">
                  Deactivate
                </Button>
              </Tooltip>
            ) : (
              <Button type="button" variant="secondary" onClick={onDeactivate} disabled={deactivatePending}>
                {deactivatePending ? "Deactivating…" : "Deactivate"}
              </Button>
            )
          ) : null}

          <ActionMenu actions={secondaryActions} />
        </div>
      </div>

      <Modal open={confirmingArchive} onClose={() => setConfirmingArchive(false)} title="Archive this Service?">
        <p>
          {`"${service.name}" will be archived. It stays readable, but its identity and draft version become read-only, and it can't be published, activated, or assigned until you restore it.`}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            onClick={() => {
              onArchive();
              setConfirmingArchive(false);
            }}
            disabled={archivePending}
          >
            {archivePending ? "Archiving…" : "Archive"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setConfirmingArchive(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
