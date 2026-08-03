"use client";

import { createElement, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { registerCommand, unregisterCommand } from "@/core/commandPalette";
import { getDocumentTemplatesListData, type DocumentTemplatesListData } from "@/modules/documentTemplates/getDocumentTemplatesListData";
import { resolveDocumentTypeIcon } from "@/modules/documentTemplates/documentTypeIcons";
import { NewTemplateModal } from "@/modules/documentTemplates/components/NewTemplateModal";
import { DocumentSearchBox } from "@/modules/documentTemplates/components/DocumentSearchBox";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: DocumentTemplatesListData };

async function load(): Promise<LoadState> {
  const result = await getDocumentTemplatesListData();
  if (!result.success) return { status: "error", message: result.error };
  return { status: "ready", data: result.data };
}

/**
 * The Document Templates Dashboard + Template Library, folded into one
 * page rather than a second route — mirroring `WorkflowsListView.tsx`'s
 * own "Dashboard folded into the List page" precedent (Checkpoint 10).
 * Walks `data.documentTypes`/`data.templates` generically; this file never
 * names a specific document type (Step 18's own Developer Experience
 * guarantee, proven the same way `SettingsView.tsx` proved it for
 * Checkpoint 11).
 */
export function DocumentTemplatesListView() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    load().then(setState);
  }, []);

  // Step 17 — "Add: Open Settings..." mirrored here for Document Templates:
  // "Open Document Templates," "Search Documents," "New Template" — the
  // same self-registering, on-mount pattern every other module's own
  // Dashboard/List page already uses.
  useEffect(() => {
    registerCommand({
      id: "open-document-templates",
      label: "Open Document Templates",
      group: "Documents",
      keywords: ["document", "template", "proposal", "contract", "invoice"],
      run: () => {
        headingRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        headingRef.current?.focus();
      },
    });
    registerCommand({
      id: "search-documents",
      label: "Search Documents",
      group: "Documents",
      keywords: ["document", "search", "find"],
      run: () => document.getElementById("documents-global-search")?.focus(),
    });
    registerCommand({
      id: "new-document-template",
      label: "New Template",
      group: "Documents",
      keywords: ["document", "template", "new", "create"],
      run: () => setNewTemplateOpen(true),
    });
    return () => {
      unregisterCommand("open-document-templates");
      unregisterCommand("search-documents");
      unregisterCommand("new-document-template");
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message={state.message} onRetry={() => { setState({ status: "loading" }); load().then(setState); }} />;
  }

  const { documentTypes, templates, recentDocuments, stats } = state.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="font-serif text-xl font-semibold text-text focus:outline-none">
            Document Templates
          </h1>
          <p className="mt-1 text-sm text-text/55">The centralized system every generated Proposal, Contract, Invoice, and Client document originates from.</p>
        </div>
        <Button type="button" onClick={() => setNewTemplateOpen(true)}>
          + New Template
        </Button>
      </div>

      <DocumentSearchBox />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-text/55">Templates</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{stats.totalTemplates}</p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-text/55">Published</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{stats.publishedTemplates}</p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-text/55">Documents Generated</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{stats.totalDocuments}</p>
        </Card>
        <Card>
          <p className="text-[11px] uppercase tracking-wide text-text/55">This Week</p>
          <p className="mt-1 font-serif text-2xl font-semibold text-text">{stats.documentsThisWeek}</p>
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <h2 className="mb-2 font-serif text-base font-semibold text-text">Template Library</h2>
          {documentTypes.map((type) => {
            const typeTemplates = templates.filter((template) => template.documentTypeId === type.id);
            if (typeTemplates.length === 0) return null;
            const iconElement = createElement(resolveDocumentTypeIcon(type.icon), { className: "h-4 w-4 shrink-0 text-accent", "aria-hidden": true });
            return (
              <div key={type.id} className="mb-4">
                <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-text">
                  {iconElement}
                  {type.label}
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {typeTemplates.map((template) => (
                    <Link key={template.id} href={`/document-templates/${template.id}`}>
                      <Card className="transition-colors duration-150 hover:border-accent/50">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-text">{template.name}</span>
                          <Badge tone={template.status === "published" ? "success" : template.status === "archived" ? "neutral" : "outline"}>{template.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-text/55">{template.description || "No description."}</p>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
          {templates.length === 0 ? <p className="text-sm text-text/55">No Templates yet — create one to get started.</p> : null}
        </div>

        <div className="lg:w-96 shrink-0">
          <h2 className="mb-2 font-serif text-base font-semibold text-text">Recent Documents</h2>
          <Card>
            {recentDocuments.length === 0 ? (
              <p className="text-sm text-text/55">No Documents generated yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {recentDocuments.map((document) => (
                  <li key={document.id}>
                    <button type="button" onClick={() => router.push(`/document-templates/documents/${document.id}`)} className="flex w-full flex-col items-start gap-0.5 text-left">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-text">{document.title}</span>
                        <Badge tone={document.status === "published" ? "success" : "outline"}>{document.status}</Badge>
                      </span>
                      <span className="text-xs text-text/55">{document.clientName ?? document.eventTitle ?? "No linked record"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <NewTemplateModal
        open={newTemplateOpen}
        onClose={() => setNewTemplateOpen(false)}
        documentTypes={documentTypes}
        onCreated={(templateId) => router.push(`/document-templates/${templateId}`)}
      />
    </div>
  );
}
