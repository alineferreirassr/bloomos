"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getVendorById } from "@/lib/data";
import type { Vendor } from "@/types/vendor";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { VendorStatusBadge } from "@/modules/vendors/components/VendorStatusBadge";
import { PreferredBadge } from "@/modules/vendors/components/PreferredBadge";
import { VendorActions } from "@/modules/vendors/components/VendorActions";

type LoadState = { status: "loading" } | { status: "not-found" } | { status: "error" } | { status: "ready"; vendor: Vendor };

async function loadVendorDetail(vendorId: string): Promise<LoadState> {
  try {
    const vendor = await getVendorById(vendorId);
    return { status: "ready", vendor };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

export function VendorDetailView({ vendorId }: { vendorId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadVendorDetail(vendorId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  const refetch = () => {
    loadVendorDetail(vendorId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This vendor could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this vendor." onRetry={refetch} />;
  }

  const { vendor } = state;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
            {vendor.company_name[0]}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-3xl font-semibold text-text">{vendor.company_name}</h2>
              <VendorStatusBadge status={vendor.status} />
              <PreferredBadge isPreferred={vendor.is_preferred} />
            </div>
            <p className="mt-1 text-sm text-text-muted">{vendor.display_name ?? vendor.email ?? ""}</p>
          </div>
        </div>

        <div className="mt-4">
          <VendorActions vendor={vendor} onChanged={refetch} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Company</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Company name" value={vendor.company_name} />
              <Field label="Display name" value={vendor.display_name} />
              <Field label="Tax ID" value={vendor.tax_id} />
              <Field label="Website" value={vendor.website} />
              <Field label="Currency" value={vendor.default_currency} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Contact</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Email" value={vendor.email} />
              <Field label="Phone" value={vendor.phone} />
            </dl>
          </Card>

          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Notes</h3>
            <p className="mt-3 text-sm text-text">{vendor.notes || "—"}</p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="font-serif text-[17px] font-semibold text-text">Internal</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3">
              <div>
                <dt className="text-xs text-text-muted">Tags</dt>
                <dd className="mt-1.5">
                  {vendor.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {vendor.tags.map((tag) => (
                        <Badge key={tag} tone="neutral">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-text">—</span>
                  )}
                </dd>
              </div>
              <Field label="Created" value={new Date(vendor.created_at).toLocaleDateString()} />
              <Field label="Updated" value={new Date(vendor.updated_at).toLocaleDateString()} />
              {vendor.archived_at ? (
                <Field label="Archived" value={new Date(vendor.archived_at).toLocaleDateString()} />
              ) : null}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value || "—"}</dd>
    </div>
  );
}
