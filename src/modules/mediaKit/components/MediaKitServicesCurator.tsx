"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/forms/FormField";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney, majorToMinor, minorToMajor } from "@/lib/money";
import { getServicesCatalog } from "@/lib/queries/services/catalog";
import { getMediaKitServiceCurationsData } from "@/modules/mediaKit/getMediaKitServiceCurationsData";
import { setMediaKitServiceIncludedAction } from "@/modules/mediaKit/setMediaKitServiceIncludedAction";
import { updateMediaKitServiceCurationAction } from "@/modules/mediaKit/updateMediaKitServiceCurationAction";
import { reorderMediaKitServicesAction } from "@/modules/mediaKit/reorderMediaKitServicesAction";
import type { MediaKitCuratedServiceRow, MediaKitServiceCuration, MediaKitServiceCurationInput } from "@/types/mediaKit";

/**
 * Composes the Services curator's view model client-side: the canonical
 * Services catalog (`getServicesCatalog`, the same already-proven client
 * entry point `useServicesCatalog.ts` uses — never a second Service
 * fetch/store) joined against this Media Kit's own curation rows. Curated
 * services come first (ordered by `sort_order`); canonical Services never
 * yet added to the Media Kit follow, in catalog order. Archived canonical
 * Services are excluded — they cannot be curated. This composition has to
 * happen client-side rather than in the Server Action that fetches
 * `curations`, because `getServicesCatalog()` depends on a browser-only
 * Supabase session — see the doc comment on
 * `getMediaKitServiceCurationsForWorkspace` in `@/lib/data/mediaKit`.
 */
async function loadCuratorRows(): Promise<{ success: true; rows: MediaKitCuratedServiceRow[] } | { success: false }> {
  const [catalogResult, curationsResult] = await Promise.all([getServicesCatalog({ sortBy: "name" }), getMediaKitServiceCurationsData()]);
  if (!curationsResult.success) return { success: false };

  const curationByServiceId = new Map<string, MediaKitServiceCuration>(curationsResult.data.map((curation) => [curation.service_id, curation]));

  const rows: MediaKitCuratedServiceRow[] = catalogResult.rows
    .filter((row) => !row.service.archived_at)
    .map((row) => ({
      serviceId: row.service.id,
      serviceName: row.service.name,
      serviceDescription: row.service.description,
      categoryName: row.categoryName,
      publishedPriceMinor: row.publishedVersion?.base_price_minor ?? null,
      publishedCurrency: row.publishedVersion?.currency ?? null,
      curation: curationByServiceId.get(row.service.id) ?? null,
    }));

  rows.sort((a, b) => {
    const aOrder = a.curation?.sort_order;
    const bOrder = b.curation?.sort_order;
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;
    return a.serviceName.localeCompare(b.serviceName);
  });

  return { success: true, rows };
}

type LoadState = { status: "loading" } | { status: "ready"; rows: MediaKitCuratedServiceRow[] } | { status: "error" };

interface OverrideFormValues {
  headline_override: string;
  description_override: string;
  public_price_major: string;
  public_price_label: string;
}

function toOverrideFormValues(row: MediaKitCuratedServiceRow): OverrideFormValues {
  return {
    headline_override: row.curation?.headline_override ?? "",
    description_override: row.curation?.description_override ?? "",
    public_price_major: row.curation?.public_starting_price_minor != null ? String(minorToMajor(row.curation.public_starting_price_minor)) : "",
    public_price_label: row.curation?.public_price_label ?? "",
  };
}

interface MediaKitServicesCuratorProps {
  /** Re-runs the Manager's own real Overview read path so the Content readiness badge reflects the real, current curation state. */
  onChanged: () => void;
}

/**
 * MEDIAKIT-03 — curation ONLY over the existing canonical Services domain
 * (`getServicesCatalog`). Never creates a second Service catalog: every row
 * here is a real canonical Service, and "adding" one to the Media Kit only
 * ever creates a `media_kit_services` curation row referencing it.
 */
export function MediaKitServicesCurator({ onChanged }: MediaKitServicesCuratorProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ serviceId: string; message: string } | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<OverrideFormValues | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const load = () => {
    setState({ status: "loading" });
    loadCuratorRows()
      .then((result) => setState(result.success ? { status: "ready", rows: result.rows } : { status: "error" }))
      .catch(() => setState({ status: "error" }));
  };

  useEffect(() => {
    let cancelled = false;
    loadCuratorRows()
      .then((result) => {
        if (cancelled) return;
        setState(result.success ? { status: "ready", rows: result.rows } : { status: "error" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Services couldn't be loaded." onRetry={load} />;
  }

  const { rows } = state;

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No Services yet"
        description="Services must be created in BloomOS Services before they can be featured on your Media Kit."
        action={
          <Link href="/services">
            <Button type="button" variant="primary">
              Go to Services
            </Button>
          </Link>
        }
      />
    );
  }

  const anyIncluded = rows.some((row) => row.curation?.is_included);
  const includedSorted = rows.filter((row) => row.curation?.is_included).sort((a, b) => (a.curation?.sort_order ?? 0) - (b.curation?.sort_order ?? 0));

  async function toggleIncluded(row: MediaKitCuratedServiceRow) {
    setRowError(null);
    setPendingServiceId(row.serviceId);
    const nextIncluded = !(row.curation?.is_included ?? false);
    const result = await setMediaKitServiceIncludedAction(row.serviceId, nextIncluded);
    setPendingServiceId(null);
    if (!result.success) {
      setRowError({ serviceId: row.serviceId, message: result.error });
      return;
    }
    if (editingServiceId === row.serviceId) setEditingServiceId(null);
    load();
    onChanged();
  }

  async function toggleFeatured(row: MediaKitCuratedServiceRow) {
    if (!row.curation) return;
    setRowError(null);
    setPendingServiceId(row.serviceId);
    const input: MediaKitServiceCurationInput = {
      headline_override: row.curation.headline_override,
      description_override: row.curation.description_override,
      public_starting_price_minor: row.curation.public_starting_price_minor,
      public_price_label: row.curation.public_price_label,
      is_featured: !row.curation.is_featured,
    };
    const result = await updateMediaKitServiceCurationAction(row.curation.id, input);
    setPendingServiceId(null);
    if (!result.success) {
      setRowError({ serviceId: row.serviceId, message: result.error });
      return;
    }
    load();
  }

  function startEditing(row: MediaKitCuratedServiceRow) {
    setEditingServiceId(row.serviceId);
    setEditValues(toOverrideFormValues(row));
    setEditError(null);
  }

  function cancelEditing() {
    setEditingServiceId(null);
    setEditValues(null);
    setEditError(null);
  }

  async function saveEditing(row: MediaKitCuratedServiceRow) {
    if (!row.curation || !editValues) return;
    setEditError(null);
    const trimmedPrice = editValues.public_price_major.trim();
    const priceMajor = trimmedPrice ? Number(trimmedPrice) : null;
    if (trimmedPrice && (Number.isNaN(priceMajor) || priceMajor === null || priceMajor < 0)) {
      setEditError("Public starting price must be a non-negative amount.");
      return;
    }
    setEditSubmitting(true);
    const input: MediaKitServiceCurationInput = {
      headline_override: editValues.headline_override.trim() || null,
      description_override: editValues.description_override.trim() || null,
      public_starting_price_minor: priceMajor !== null ? majorToMinor(priceMajor) : null,
      public_price_label: editValues.public_price_label.trim() || null,
      is_featured: row.curation.is_featured,
    };
    const result = await updateMediaKitServiceCurationAction(row.curation.id, input);
    setEditSubmitting(false);
    if (!result.success) {
      setEditError(result.error);
      return;
    }
    setEditingServiceId(null);
    setEditValues(null);
    load();
  }

  async function moveService(curationId: string, direction: "up" | "down") {
    setReorderError(null);
    const index = includedSorted.findIndex((row) => row.curation?.id === curationId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= includedSorted.length) return;

    const reordered = [...includedSorted];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const orderedCurationIds = reordered.map((row) => row.curation!.id);
    const result = await reorderMediaKitServicesAction(orderedCurationIds);
    if (!result.success) {
      setReorderError(result.error);
      return;
    }
    load();
  }

  return (
    <div className="space-y-4">
      {!anyIncluded ? (
        <Card className="border-accent/30 bg-accent-100/40">
          <p className="text-sm text-text">Choose the services you want to feature in your Media Kit.</p>
        </Card>
      ) : null}

      {reorderError ? (
        <p role="alert" className="text-xs text-danger">
          {reorderError}
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((row) => {
          const isIncluded = row.curation?.is_included ?? false;
          const isPending = pendingServiceId === row.serviceId;
          const isEditing = editingServiceId === row.serviceId;
          const includedIndex = includedSorted.findIndex((r) => r.serviceId === row.serviceId);

          const displayHeadline = row.curation?.headline_override || row.serviceName;
          const displayDescription = row.curation?.description_override || row.serviceDescription;
          const displayPriceMinor = row.curation?.public_starting_price_minor ?? null;
          const displayPriceLabel = row.curation?.public_price_label;

          return (
            <li key={row.serviceId}>
              <Card>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="pt-0.5">
                      <Checkbox
                        aria-label={isIncluded ? `Remove ${row.serviceName} from Media Kit` : `Add ${row.serviceName} to Media Kit`}
                        checked={isIncluded}
                        disabled={isPending}
                        onChange={() => toggleIncluded(row)}
                      />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-[16px] font-semibold text-text">{row.serviceName}</h3>
                        {row.categoryName ? <span className="text-xs text-text-muted">{row.categoryName}</span> : null}
                        {row.curation?.is_featured ? <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent uppercase">Featured</span> : null}
                      </div>
                      {row.serviceDescription ? <p className="mt-1 text-xs text-text-muted">{row.serviceDescription}</p> : null}
                      {row.publishedPriceMinor != null && row.publishedCurrency ? (
                        <p className="mt-1 text-xs text-text-muted">Canonical price: {formatMoney(row.publishedPriceMinor, row.publishedCurrency)}</p>
                      ) : null}
                    </div>
                  </div>

                  {isIncluded ? (
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      {includedSorted.length > 1 ? (
                        <div className="flex flex-col">
                          <button
                            type="button"
                            aria-label="Move up"
                            disabled={includedIndex === 0}
                            onClick={() => moveService(row.curation!.id, "up")}
                            className="flex h-5 w-6 items-center justify-center text-text-muted transition-colors duration-150 hover:text-text disabled:pointer-events-none disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            aria-label="Move down"
                            disabled={includedIndex === includedSorted.length - 1}
                            onClick={() => moveService(row.curation!.id, "down")}
                            className="flex h-5 w-6 items-center justify-center text-text-muted transition-colors duration-150 hover:text-text disabled:pointer-events-none disabled:opacity-30"
                          >
                            ▼
                          </button>
                        </div>
                      ) : null}
                      <label className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Checkbox checked={row.curation?.is_featured ?? false} disabled={isPending} onChange={() => toggleFeatured(row)} />
                        Featured
                      </label>
                      {!isEditing ? (
                        <Button type="button" variant="secondary" size="sm" onClick={() => startEditing(row)}>
                          Edit presentation
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {rowError?.serviceId === row.serviceId ? (
                  <p role="alert" className="mt-2 text-xs text-danger">
                    {rowError.message}
                  </p>
                ) : null}

                {isIncluded && isEditing && editValues ? (
                  <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                    {editError ? (
                      <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                        {editError}
                      </p>
                    ) : null}
                    <FormField label="Headline override" htmlFor={`override_headline_${row.serviceId}`} hint={`Falls back to "${row.serviceName}" when empty.`}>
                      <Input
                        id={`override_headline_${row.serviceId}`}
                        placeholder={row.serviceName}
                        value={editValues.headline_override}
                        onChange={(event) => setEditValues({ ...editValues, headline_override: event.target.value })}
                      />
                    </FormField>
                    <FormField
                      label="Description override"
                      htmlFor={`override_description_${row.serviceId}`}
                      hint={row.serviceDescription ? "Falls back to the canonical Service description when empty." : "This Service has no canonical description to fall back to."}
                    >
                      <Textarea
                        id={`override_description_${row.serviceId}`}
                        rows={3}
                        placeholder={row.serviceDescription ?? ""}
                        value={editValues.description_override}
                        onChange={(event) => setEditValues({ ...editValues, description_override: event.target.value })}
                      />
                    </FormField>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FormField label="Public starting price" htmlFor={`override_price_${row.serviceId}`} hint="Shown publicly only when set. Leave blank to omit pricing.">
                        <Input
                          id={`override_price_${row.serviceId}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={editValues.public_price_major}
                          onChange={(event) => setEditValues({ ...editValues, public_price_major: event.target.value })}
                        />
                      </FormField>
                      <FormField label="Public price label" htmlFor={`override_price_label_${row.serviceId}`} hint='e.g. "Starting at", "Packages from"'>
                        <Input
                          id={`override_price_label_${row.serviceId}`}
                          value={editValues.public_price_label}
                          onChange={(event) => setEditValues({ ...editValues, public_price_label: event.target.value })}
                        />
                      </FormField>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button type="button" onClick={() => saveEditing(row)} disabled={editSubmitting}>
                        {editSubmitting ? "Saving…" : "Save"}
                      </Button>
                      <Button type="button" variant="secondary" onClick={cancelEditing} disabled={editSubmitting}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {isIncluded ? (
                  <div className="mt-4 border-t border-border/60 pt-3">
                    <p className="mb-1.5 text-[10px] tracking-[0.1em] text-text-muted uppercase">Public presentation preview</p>
                    <div className="rounded-[0.625rem] border border-accent/20 bg-surface-tint px-4 py-3">
                      <p className="font-serif text-sm font-semibold text-text">{displayHeadline}</p>
                      {displayDescription ? <p className="mt-1 text-xs text-text-muted">{displayDescription}</p> : null}
                      {displayPriceMinor != null ? (
                        <p className="mt-1 text-xs text-accent">
                          {displayPriceLabel ? `${displayPriceLabel} ` : "Starting at "}
                          {formatMoney(displayPriceMinor, row.publishedCurrency ?? "USD")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
