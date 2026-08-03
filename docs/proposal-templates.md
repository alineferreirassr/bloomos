# Proposal Template Library

`lib/data/mock/proposalTemplatesStore.ts`, `core/proposalPlatform/index.ts`'s `getCoreProposalTemplatesService()`.

## 8 system templates, seeded

`luxury_proposal`, `picnic_proposal`, `hotel_decoration`, `proposal_event`, `photography`, `ugc_services`, `digital_services`, `general_services` ship pre-seeded — the same "system vs. custom" split `ChecklistTemplate` established. A 9th key, `custom_template`, is reserved for a workspace's own saved templates via `createCustomTemplate`.

MVP runs exactly one Workspace (`CURRENT_WORKSPACE_ID`), so system templates are seeded directly against it rather than modeled as cross-workspace globals.

## Structure

Every template carries `header`/`hero`/`sectionKeys`/`gallery`/`pricing`/`timeline`/`faq`/`terms`/`policies`/`footer` — the exact 10 surfaces Step 2 names. `gallery`/`pricing`/`timeline`/`faq` are booleans (does this template render that surface at all) rather than nested config, since their actual content always comes from the document's own `sections`/`packageIds`/computed pricing, never a second copy stored on the template itself.

`sectionKeys` names which of the 13 Section Library entries this template pulls from by default — the Builder (Step 3) uses this list to pre-populate a new version's sections.

## System vs. custom

System templates (`isSystemTemplate: true`) cannot be archived; only workspace-created custom templates (`isSystemTemplate: false`, `key: "custom_template"`) can be. `createCustomTemplateAction`/`archiveTemplate` are the two mutation paths, both gated on `proposal_templates.manage`.
