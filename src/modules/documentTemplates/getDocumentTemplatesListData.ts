"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerDocumentTypes } from "@/modules/documentTemplates/registerDocumentTypes";
import { registerMergeFields } from "@/modules/documentTemplates/registerMergeFields";
import { getDocumentsManager } from "@/core/documents/manager";
import { listDocumentTypes } from "@/core/documents/documentTypeRegistry";
import type { ComposedDocumentStatus, DocumentTypeDefinition } from "@/types/documentPlatform";

const GENERIC_ACCESS_ERROR = "Document Templates aren't available right now.";

registerDocumentTypes();
registerMergeFields();

export interface TemplateSummary {
  id: string;
  documentTypeId: string;
  name: string;
  description: string;
  status: ComposedDocumentStatus;
  version: number;
  updatedAt: string;
}

export interface ComposedDocumentSummary {
  id: string;
  templateId: string;
  documentTypeId: string;
  title: string;
  clientName: string | null;
  eventTitle: string | null;
  status: ComposedDocumentStatus;
  currentVersion: number;
  updatedAt: string;
}

export interface DocumentTemplatesListData {
  documentTypes: DocumentTypeDefinition[];
  templates: TemplateSummary[];
  recentDocuments: ComposedDocumentSummary[];
  stats: {
    totalTemplates: number;
    publishedTemplates: number;
    totalDocuments: number;
    documentsThisWeek: number;
  };
}

export type GetDocumentTemplatesListDataResult = { success: true; data: DocumentTemplatesListData } | { success: false; error: string };

function isWithinLastWeek(iso: string): boolean {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(iso).getTime() <= sevenDaysMs;
}

/**
 * The Document Templates List/Dashboard's own one-call aggregate — every
 * registered document type (Step 2), every Template in this Workspace, and
 * the most recently updated compiled Documents, mirroring
 * `getWorkflowDashboardData.ts`'s own "folded into the List page rather
 * than a second route" precedent (Checkpoint 10).
 */
export async function getDocumentTemplatesListData(): Promise<GetDocumentTemplatesListDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const manager = getDocumentsManager();
  const [templates, documents] = await Promise.all([manager.listTemplates(session.workspace.id), manager.listComposedDocuments(session.workspace.id)]);

  return {
    success: true,
    data: {
      documentTypes: listDocumentTypes(),
      templates: templates.map(({ id, documentTypeId, name, description, status, version, updatedAt }) => ({ id, documentTypeId, name, description, status, version, updatedAt })),
      recentDocuments: documents.slice(0, 10).map(({ id, templateId, documentTypeId, metadata, status, currentVersion, updatedAt }) => ({
        id,
        templateId,
        documentTypeId,
        title: metadata.title,
        clientName: metadata.clientName,
        eventTitle: metadata.eventTitle,
        status,
        currentVersion,
        updatedAt,
      })),
      stats: {
        totalTemplates: templates.length,
        publishedTemplates: templates.filter((template) => template.status === "published").length,
        totalDocuments: documents.length,
        documentsThisWeek: documents.filter((document) => isWithinLastWeek(document.updatedAt)).length,
      },
    },
  };
}
