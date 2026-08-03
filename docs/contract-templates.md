# Contract Builder Template Library

`lib/data/mock/contractBuilderTemplatesStore.ts`, `types/contractPlatform.ts` (`ContractBuilderTemplate`).

## 11 named templates (Step 2)

`master_service_agreement`, `proposal_agreement`, `picnic_agreement`, `hotel_decoration_agreement`, `photography_agreement`, `ugc_agreement`, `vendor_agreement`, `independent_contractor`, `nda`, `employment_agreement`, `custom_template` — `CONTRACT_BUILDER_TEMPLATE_KEYS` in `types/contractPlatform.ts`, seeded system rows in `contractBuilderTemplatesStore.ts`.

Each template names its own 8 template surfaces:

| Surface | Where it lives |
|---|---|
| Header | `structure.header` |
| Sections | `structure.sectionKeys` — which of the 8 `ContractSectionKey`s this template populates by default |
| Variables | Nothing to configure — always resolved fresh by the [Variable Engine](variable-engine.md) |
| Clauses | `structure.defaultClauseKeys` |
| Attachments | Nothing to configure — always real `ContractExhibit` rows |
| Optional Clauses | `structure.optionalClauseKeys` — clauses a template marks includable-but-not-required |
| Signature Placeholders | `structure.hasSignaturePlaceholders` |
| Footer | `structure.footer` |

## Why `ContractTemplate` isn't reused here

See [`contract-platform.md`](contract-platform.md)'s own section on this — the real `ContractTemplate` entity is flat, read-only, unseeded text; `ContractBuilderTemplate` is the new, additive, structured library this checkpoint's spec actually asks for.

## Repository

`mockContractBuilderTemplatesRepository` — `listTemplates(workspaceId, includeArchived?)`, `getTemplateById(id)`, `createCustomTemplate(workspaceId, actor, input)`, `archiveTemplate(id)`. Accessed via `getCoreContractBuilderTemplatesService()` (`core/contractPlatform/index.ts`).
