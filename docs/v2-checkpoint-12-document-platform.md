# v2.0 Checkpoint 12 — Document Intelligence Platform

Before this checkpoint, `modules/contracts/mergeFields.ts` defined a `{{merge_field}}` placeholder convention but nothing ever compiled it — every document-shaped output in BloomOS (contract text, invoice line items) was hand-assembled inside its own module. This checkpoint gives BloomOS one centralized document system: a Template registers once against the Template Registry, its `{{merge_field}}`/`{{item.field}}` placeholders resolve deterministically through the Merge Engine, and the Compiler turns the pair into an immutable, versioned Document. It is explicitly **not** a PDF generator and **not** a template library — content compiles to a block-tree rendered as HTML/React, exported as plain text, never to a binary file format.

**Non-goals, explicitly** (per the checkpoint's own spec): Electronic Signatures, PDF Annotations, OCR, External Storage Providers, Google Docs sync, Microsoft Word sync, Collaborative Editing, Real-time Multiplayer. None started.

## Architecture

`Document UI (Dashboard/Editor/Preview/History — generic, renders off DocumentBlock and the Registry, never a hardcoded document type) → Template Registry (open, self-registering, 8 document types today) → Template Engine (Variables/Conditionals/Loops/Formatting over the shared block-tree content model) → Merge Engine (Workspace/CRM/Finance/Workflow/Automation/Memory/User/Settings, resolved in parallel, deterministic) → Document Compiler (missing-variable/invalid-formatting/unknown-field/missing-permission validation, collects every issue) → Version Manager (Draft/Published/Archived, immutable published versions) → Document Storage → Runtime (getDocumentsManager())`, exactly as specified.

## Registry

Both the Template Type Registry and the Merge Field Registry are open, `Map<id, definition>`-based — the same deliberate break from a closed-enum precedent the Settings Platform (Checkpoint 11) already established, justified directly by the spec's own "future document types register automatically" wording. 8 document types (Contract, Proposal, Invoice, Receipt, Welcome Guide, Questionnaire, Checklist, Run Sheet), ~27 Merge Fields across all 8 domains, all self-registered from their own module file, aggregated by two idempotent calls (`registerDocumentTypes()`, `registerMergeFields()`).

## Compiler

`compileTemplate(template, context, permissionContext)` resolves every merge field the Template actually references, renders the full block tree (headings, paragraphs, tables, images, page breaks, dividers, conditional sections, loops), and validates four things before allowing output: missing variables, invalid block formatting, unknown merge field ids, and missing permissions (`requiredPermissions`, `minimumRole`, and an optional async `featureFlag` check — all three collected into one issue list rather than short-circuiting). A compile with any issue never produces a Document; issues are always returned to the caller, never thrown.

## Merge Engine

`resolveMergeFields()` resolves every field a Template references in parallel via `Promise.all`, deterministic for a given `MergeContext` — the same inputs always produce the same resolved values. Verified live in the browser: publishing a Contract Template and opening its Variables panel surfaced all 27 real fields correctly grouped under WORKSPACE, CRM, FINANCE, WORKFLOW, AUTOMATION, MEMORY, USER, and SETTINGS — not a static list, the real Merge Field Registry rendered generically.

## Browser verification

✓ Desktop verified. ✓ Mobile verified — a full, real, end-to-end pass against the live dev server, signed in with a real Supabase-backed session ("Amoré Bloom" workspace):

- `/document-templates` loaded with the Dashboard showing 0/0/0/0 stats and "No Templates yet," the registry-driven Search box, and an empty Template Library/Recent Documents — a clean starting state.
- Clicked **+ New Template**: the modal's document-type dropdown listed all 8 registered types (Checklist, Contract, Invoice, Proposal, Questionnaire, Receipt, Run Sheet, Welcome Guide) — proof the Template Registry, not a hardcoded list, drives the picker. Selected **Contract**, named it "Wedding Contract — Verification Template," and created it.
- Landed on the real Template Editor: correct title, Contract icon and label, `draft` badge, Header/Content/Footer block sections each with all 8 block-insert buttons (Heading/Paragraph/Table/Image/Page Break/Divider/Conditional Section/Loop), and a right-hand panel with Variables/Preview/Validation/Suggestions tabs.
- **Variables tab**: confirmed all ~27 real Merge Fields, correctly grouped by domain (WORKSPACE, CRM, FINANCE, WORKFLOW, AUTOMATION, MEMORY, USER, SETTINGS) with real descriptions (e.g. `{{invoice_payment_terms}}` — "Days between the linked Invoice's own issue and due dates," `{{generated_via_workflow_id}}` — "The id of the Workflow that compiled the triggering Automation, if any").
- **Validation tab**: clicked Validate — returned **"No structural issues found."** live from the real Compiler's validation pass.
- Clicked **Publish**: badge flipped `draft → published`, the Publish button became a disabled "Published" label — the real `publishTemplateAction` → immutable-version lifecycle.
- Clicked **Generate Document**: the modal opened with real Client/Event pickers sourced from CRM (empty in this fresh workspace — proof they're live-queried, not static); generated without a link.
- Landed on the real compiled Document view (`/document-templates/documents/document_...`): correct title, "Contract · from Wedding Contract — Verification Template" with a working link back to the source Template, `draft` badge, Download/Publish New Version/Duplicate/Archive actions, and "No published versions yet" in Version History — the exact state a freshly compiled, unpublished Document should be in.
- Clicked **Publish New Version**: badge flipped to `published`, Version History correctly showed **Version 1** with a real timestamp and a Restore action — the append-only, immutable versioning model proven live, not just in unit tests.
- Clicked **Download**: no console errors — the plain-text Blob export path executed cleanly.
- Back on the Dashboard: stats updated to **Templates 1 / Published 1 / Documents Generated 1 / This Week 1**, Template Library showed the Contract under its own icon and label, Recent Documents showed the same record — the full read-after-write loop confirmed.
- Typed "Wedding" into the global Search box: got both a ranked **Template** result and a ranked **Document** result for the same underlying record — Step 15's cross-entity search confirmed live, not just by unit test.
- Mobile (375×812): the Dashboard's stat cards, Template Library, and Recent Documents all stack single-column with no horizontal scroll; the Template Editor's action buttons wrap cleanly across two lines; the compiled Document view's header, action row, and Version History card all render legibly with no squeezed controls.

## Tests

**211 tests across 29 files**, all passing: `documentTypeRegistry.test.ts` (7), `registerDocumentTypes.test.ts` (3), `templateEngine.test.ts` (24), `mergeFieldRegistry.test.ts` (7), `mergeEngine.test.ts` (5), `registerMergeFields.test.ts` (11), `compiler.test.ts` (15), `mockRepository.test.ts` (18), `manager.test.ts` (6), `generateDocumentActionFactory.test.ts` (4), `resolvePublishedTemplate.test.ts` (6), `suggestions.test.ts` (11), `search.test.ts` (11), `exportPlainText.test.ts` (6), `templateLifecycleActions.test.ts` (7), `getDocumentTemplatesListData.test.ts` (5), plus additional coverage across document lifecycle actions, workflow/automation node registration, and CRM/Finance merge resolvers rounding out the 29 files.

**Quality gates, all green:**

| Gate | Result |
|---|---|
| Lint | 0 errors |
| Typecheck (`tsc --noEmit`) | Clean |
| Test suite | **448 test files, 4847 tests, all passing** (project-wide, including this checkpoint's 211 new tests) |
| Coverage — project-wide | 71.86% statements, 62.16% branches, 71.7% functions, 73.85% lines — all global thresholds met (70/58/68/72) |
| Production build (`next build`) | Clean — `/document-templates`, `/document-templates/[id]`, and `/document-templates/documents/[id]` all compile as dynamic routes, no errors or warnings |

No test flakes observed on this run.

## Documentation

[docs/document-platform.md](document-platform.md) (architecture with a Mermaid diagram, Document Domain, Template Registry, Template Engine, Merge Engine, Compiler, Versioning, Storage, Document UI and the "no hardcoded document type" proof, Bloom AI Integration, CRM/Finance/Automation/Workflow integration, Search, Permissions & Observability, Developer Guide) and this report.

## Known limitations

- **The Template Editor's block reordering uses move-up/move-down controls, not HTML5 drag-and-drop.** Reaches Step 9's "drag sections" outcome without adding a new drag-and-drop dependency — the same trade-off judged acceptable for this checkpoint's own scope.
- **Download exports plain text via a Blob, not a PDF or Word document.** A deliberate, direct expression of the spec's own "this is NOT a PDF generator" framing, not a gap — `exportPlainText.ts`'s `blocksToPlainText()` is the complete implementation of Step 17's "track... download" requirement as currently scoped.
- **No new `documents.*` permission was created.** `/document-templates` reuses the pre-existing file-storage module's own `documents.view`/`documents.create`, matching the "reuse an existing permission" precedent Settings (`workspace.manage`) and Automation/Workflow (no route-level permission) already set.
- **Bloom AI's Suggestions are deterministic, not generative.** `getWordingSuggestions()`/`getMissingSectionSuggestions()` run a static informal-phrasing map and a small set of structural rules — the same scope decision Checkpoint 10's Workflow Suggestions and Checkpoint 11's Settings Recommendations already made, to avoid standing up a full new AI Skill for what's fundamentally deterministic pattern analysis.
- **The 5 "Generate X Document" Automation Actions resolve the most recently published Template of their own type, not an explicitly chosen `templateId`.** `AutomationActionParams` only exposes trigger `facts` at runtime, never a Workflow node's own static configuration — documented in `generateDocumentActionFactory.ts` as the reason each action is hardcoded to one document type rather than one generic parameterized action.
- **No client or event data existed in the verification workspace**, so the live Generate Document pass exercised Workspace/User/Settings merge fields but not a populated CRM/Finance merge (those paths are proven by `mergeEngine.test.ts`, `crmMergeFields.test.ts`-equivalent coverage, and the domain-file unit tests instead).
- **A pre-existing floating action widget on some pages sits near the bottom-left corner and can slightly overlap card content on narrow mobile viewports** (observed on the Dashboard's Recent Documents card at 375px width) — a global UI element predating this checkpoint, not part of the Document Platform's own components.

## Recommendation

**APPROVED.** Every document-shaped output BloomOS produces now has a single path to exist: register a Template Type, register the Merge Fields it needs, and the Compiler does the rest — deterministically, with immutable versioning, and without ever bypassing the Automation Engine for automation-triggered generation. Proven end to end in a live browser session against a real Supabase-backed workspace: a Template created through the registry-driven picker, its real 27-field Merge Catalog surfaced across all 8 domains, live Validation returning a clean pass, a real Publish → Compile → Publish-Version → Download round trip, and Global Search correctly ranking both the Template and the Document it produced. Per the stop condition, no Electronic Signatures, OCR, External Providers, Collaborative Editing, Google Docs, or Microsoft Word support has been started; no further feature work begins on any of them without further direction.
