"use client";

import { createElement, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Toast } from "@/components/ui/Toast";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { registerCommand, unregisterCommand } from "@/core/commandPalette";
import { getTemplateEditorData, type TemplateEditorData } from "@/modules/documentTemplates/getTemplateEditorData";
import { updateTemplateDraftAction } from "@/modules/documentTemplates/updateTemplateDraftAction";
import { publishTemplateAction, archiveTemplateAction, unarchiveTemplateAction, duplicateTemplateAction } from "@/modules/documentTemplates/templateLifecycleActions";
import { validateTemplateAction } from "@/modules/documentTemplates/validateTemplateAction";
import { resolveDocumentTypeIcon } from "@/modules/documentTemplates/documentTypeIcons";
import { BlockEditor } from "@/modules/documentTemplates/components/BlockEditor";
import { BlockPreview } from "@/modules/documentTemplates/components/BlockPreview";
import { VariablesPanel } from "@/modules/documentTemplates/components/VariablesPanel";
import { GenerateDocumentModal } from "@/modules/documentTemplates/components/GenerateDocumentModal";
import { SuggestionsPanel } from "@/modules/documentTemplates/components/SuggestionsPanel";
import type { DocumentBlock, DocumentIssue, DocumentSuggestion, ParagraphBlock } from "@/types/documentPlatform";

function replaceBlockRuns(blocks: DocumentBlock[], blockId: string, runs: DocumentSuggestion["suggestedRuns"]): DocumentBlock[] {
  if (!runs) return blocks;
  return blocks.map((block) => {
    if (block.id === blockId && (block.type === "heading" || block.type === "paragraph")) return { ...block, runs };
    if (block.type === "conditional") return { ...block, blocks: replaceBlockRuns(block.blocks, blockId, runs) };
    if (block.type === "loop") return { ...block, itemBlocks: replaceBlockRuns(block.itemBlocks, blockId, runs) };
    return block;
  });
}

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: TemplateEditorData };

async function load(templateId: string): Promise<LoadState> {
  const result = await getTemplateEditorData(templateId);
  if (!result.success) return { status: "error", message: result.error };
  return { status: "ready", data: result.data };
}

const AUTOSAVE_DEBOUNCE_MS = 800;

export function TemplateEditorView({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState<DocumentBlock[]>([]);
  const [header, setHeader] = useState<DocumentBlock[]>([]);
  const [footer, setFooter] = useState<DocumentBlock[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [issues, setIssues] = useState<DocumentIssue[] | null>(null);
  const [validating, setValidating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const skipNextAutosave = useRef(true);

  useEffect(() => {
    load(templateId).then((next) => {
      setState(next);
      if (next.status === "ready") {
        setName(next.data.template.name);
        setDescription(next.data.template.description);
        setContent(next.data.template.content);
        setHeader(next.data.template.header);
        setFooter(next.data.template.footer);
      }
    });
  }, [templateId]);

  useEffect(() => {
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    setSaveState("saving");
    const timeout = setTimeout(() => {
      updateTemplateDraftAction(templateId, { name, description, content, header, footer }).then((result) => {
        setSaveState(result.success ? "saved" : "idle");
        if (!result.success) setToast(result.error);
      });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally excludes `templateId` (stable per mount) and re-runs only on real content edits.
  }, [name, description, content, header, footer]);

  async function runValidation() {
    setValidating(true);
    const result = await validateTemplateAction(templateId);
    setValidating(false);
    if (result.success) setIssues(result.issues);
    else setToast(result.error);
  }

  async function handlePublish() {
    const result = await publishTemplateAction(templateId);
    if (result.success) {
      setState((current) => (current.status === "ready" ? { ...current, data: { ...current.data, template: { ...current.data.template, status: "published" } } } : current));
    } else {
      setToast(result.error);
    }
  }

  // Step 17 — contextual Editor commands: both only ever close over stable
  // values (`templateId` from props, `setState`/`setGenerateOpen`), so
  // registering once on mount never risks a stale closure the way capturing
  // `state`/`content` directly would.
  useEffect(() => {
    registerCommand({
      id: "publish-document-template",
      label: "Publish Template",
      group: "Documents",
      keywords: ["document", "template", "publish"],
      run: () => handlePublish(),
    });
    registerCommand({
      id: "generate-document-from-template",
      label: "Generate Document",
      group: "Documents",
      keywords: ["document", "generate", "compile"],
      run: () => setGenerateOpen(true),
    });
    return () => {
      unregisterCommand("publish-document-template");
      unregisterCommand("generate-document-from-template");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `handlePublish` only closes over the stable `templateId` prop and `setState`/`setToast`; re-registering on every render would just churn the palette for no behavioral change.
  }, [templateId]);

  async function handleArchiveToggle(archived: boolean) {
    const result = archived ? await unarchiveTemplateAction(templateId) : await archiveTemplateAction(templateId);
    if (!result.success) {
      setToast(result.error);
      return;
    }
    load(templateId).then(setState);
  }

  async function handleDuplicate() {
    const result = await duplicateTemplateAction(templateId);
    if (result.success) router.push(`/document-templates/${result.templateId}`);
    else setToast(result.error);
  }

  function handleApplyWording(blockId: string, runs: DocumentSuggestion["suggestedRuns"]) {
    setHeader((current) => replaceBlockRuns(current, blockId, runs));
    setContent((current) => replaceBlockRuns(current, blockId, runs));
    setFooter((current) => replaceBlockRuns(current, blockId, runs));
  }

  function handleAddMissingSection(block: ParagraphBlock) {
    setContent((current) => [...current, block]);
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message={state.message} onRetry={() => { setState({ status: "loading" }); load(templateId).then(setState); }} />;
  }

  const { template, documentType, mergeFields, canPublish } = state.data;
  // Rendered via `createElement` rather than a `<Icon />` JSX tag — `resolveDocumentTypeIcon` is a static lookup table, never a component factory (see `modules/workflow/canvas/NodeRenderer.tsx`'s own identical precedent).
  const iconElement = createElement(resolveDocumentTypeIcon(documentType?.icon ?? ""), { className: "h-5 w-5 shrink-0 text-accent", "aria-hidden": true });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {iconElement}
          <div>
            <h1 className="font-serif text-xl font-semibold text-text">{name || "Untitled Template"}</h1>
            <p className="text-xs text-text/55">{documentType?.label ?? template.documentTypeId}</p>
          </div>
          <Badge tone={template.status === "published" ? "success" : template.status === "archived" ? "neutral" : "outline"}>{template.status}</Badge>
          {saveState === "saving" ? <span className="text-xs text-text/45">Saving…</span> : null}
          {saveState === "saved" ? <span className="text-xs text-accent">Saved</span> : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="secondary" onClick={() => setGenerateOpen(true)}>
            Generate Document
          </Button>
          {canPublish ? (
            <>
              {template.status !== "archived" ? (
                <Button type="button" onClick={handlePublish} disabled={template.status === "published"}>
                  {template.status === "published" ? "Published" : "Publish"}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={handleDuplicate}>
                Duplicate
              </Button>
              <Button type="button" variant="ghost" onClick={() => handleArchiveToggle(template.status === "archived")}>
                {template.status === "archived" ? "Unarchive" : "Archive"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <LuxuryCard>
        <div className="flex flex-col gap-2">
          <Input value={name} placeholder="Template name" onChange={(event) => setName(event.target.value)} />
          <Textarea value={description} placeholder="Description" onChange={(event) => setDescription(event.target.value)} />
        </div>
      </LuxuryCard>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <LuxuryCard>
            <h2 className="mb-2 font-serif text-sm font-semibold text-text">Header</h2>
            <BlockEditor blocks={header} onChange={setHeader} />
          </LuxuryCard>
          <LuxuryCard className="mt-4">
            <h2 className="mb-2 font-serif text-sm font-semibold text-text">Content</h2>
            <BlockEditor blocks={content} onChange={setContent} />
          </LuxuryCard>
          <LuxuryCard className="mt-4">
            <h2 className="mb-2 font-serif text-sm font-semibold text-text">Footer</h2>
            <BlockEditor blocks={footer} onChange={setFooter} />
          </LuxuryCard>
        </div>

        <div className="lg:w-96 shrink-0">
          <LuxuryCard>
            <Tabs defaultValue="variables">
              <TabList aria-label="Template Editor panels">
                <Tab value="variables">Variables</Tab>
                <Tab value="preview">Preview</Tab>
                <Tab value="validation">Validation</Tab>
                <Tab value="suggestions">Suggestions</Tab>
              </TabList>
              <TabPanel value="variables" className="mt-3">
                <VariablesPanel mergeFields={mergeFields} />
              </TabPanel>
              <TabPanel value="preview" className="mt-3">
                {header.length > 0 ? <BlockPreview blocks={header} /> : null}
                <BlockPreview blocks={content} />
                {footer.length > 0 ? <BlockPreview blocks={footer} /> : null}
              </TabPanel>
              <TabPanel value="validation" className="mt-3">
                <Button type="button" variant="secondary" onClick={runValidation} disabled={validating}>
                  {validating ? "Validating…" : "Validate"}
                </Button>
                {issues !== null ? (
                  issues.length === 0 ? (
                    <p className="mt-2 text-sm text-accent">No structural issues found.</p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {issues.map((issue) => (
                        <li key={`${issue.code}-${issue.target}`} className="text-xs text-danger">
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </TabPanel>
              <TabPanel value="suggestions" className="mt-3">
                <SuggestionsPanel templateId={templateId} content={content} onApplyWording={handleApplyWording} onAddMissingSection={handleAddMissingSection} />
              </TabPanel>
            </Tabs>
          </LuxuryCard>
        </div>
      </div>

      <GenerateDocumentModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        templateId={templateId}
        onGenerated={(documentId) => router.push(`/document-templates/documents/${documentId}`)}
      />

      {toast ? <Toast tone="danger" message={toast} onDismiss={() => setToast(null)} /> : null}
    </div>
  );
}
