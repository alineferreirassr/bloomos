import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

interface ServicesLoadingSkeletonProps {
  rows?: number;
  rowHeightClassName?: string;
  className?: string;
}

/** A generic row-shaped loading placeholder — reused for Catalog rows, Health Dashboard rows, Template category rows, and anywhere else a Services list is still loading. Built entirely from the existing Skeleton primitive; no new loading visual language. */
export function ServicesLoadingSkeleton({ rows = 3, rowHeightClassName = "h-10", className = "" }: ServicesLoadingSkeletonProps) {
  return (
    <div aria-busy="true" aria-live="polite" className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={`w-full ${rowHeightClassName}`} />
      ))}
    </div>
  );
}

export function ServicesCatalogEmptyState({ action }: { action?: ReactNode }) {
  return <EmptyState title="No Services yet" description="Create your first Service to start building your catalog." action={action} />;
}

export function ServicesCatalogErrorState({ onRetry }: { onRetry?: () => void }) {
  return <ErrorState message="We couldn't load your Services catalog." onRetry={onRetry} />;
}

export function HealthDashboardEmptyState() {
  return <EmptyState title="No Services to check" description="Once you create Services, their health will show up here." />;
}

export function HealthDashboardErrorState({ onRetry }: { onRetry?: () => void }) {
  return <ErrorState message="We couldn't load the Health Dashboard." onRetry={onRetry} />;
}

export function RequirementsEmptyState() {
  return <EmptyState title="No requirements yet" description="This booking doesn't have any generated requirements." />;
}

export function TemplateCategoryEmptyState({ categoryLabel }: { categoryLabel: string }) {
  return <EmptyState title={`No ${categoryLabel} yet`} description="Add one to get started." />;
}

export function ServiceEditorErrorState({ onRetry }: { onRetry?: () => void }) {
  return <ErrorState message="We couldn't load this Service." onRetry={onRetry} />;
}

/** An honest placeholder for a Service Detail tab whose data contract (a real feature hook) doesn't exist yet — never a partial build of that screen. */
export function ServiceComingSoonPanel({ label }: { label: string }) {
  return <EmptyState title={`${label} is coming in the next checkpoint`} description="This section isn't built yet — nothing here is broken." />;
}
