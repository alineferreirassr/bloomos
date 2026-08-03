# Writing Engine (v2 Checkpoint 20)

The AI Writing Studio, and the Proposal Assistant that embeds it — a text-transform tool that is explicit and honest about running **without** a connected generative AI provider, per this checkpoint's stop condition ("Do NOT integrate OpenAI, Anthropic or Gemini APIs").

## Task types and actions

`core/ai/copilot/writingEngine.ts`:

```ts
const WRITING_TASK_TYPES = [
  "proposal", "email", "contract", "follow_up", "reminder",
  "invoice_notes", "client_message", "internal_notes",
] as const;

const WRITING_ACTIONS = [
  "rewrite", "shorten", "luxury_tone", "professional_tone",
  "friendly_tone", "translate", "grammar",
] as const;

function applyWritingAction(input: { taskType: WritingTaskType; action: WritingAction; sourceText: string }): WritingResult;

interface WritingResult {
  outputText: string;
  action: WritingAction;
  applied: boolean;   // false only for `translate`
  note: string;       // always present, explains what actually happened
}
```

`taskType` exists to label *what kind of document* the text is (shown in the UI, informs which Prompt Library entries are relevant) — the deterministic transform itself only depends on `action`.

## What each action actually does (deterministic, no model call)

| Action | Behavior |
|---|---|
| `rewrite` | Normalizes whitespace and returns the text unchanged in substance — the "no-op with cleanup" baseline. |
| `shorten` | Keeps the first two sentences (naive `.`/`!`/`?` split); text of two sentences or fewer is returned as-is. |
| `luxury_tone` | Prepends a fixed luxury-register opener ("With warmest regards,"). |
| `professional_tone` | Prepends a fixed professional-register opener. |
| `friendly_tone` | Prepends a fixed friendly-register opener. |
| `grammar` | Normalizes whitespace and capitalizes the first letter of each sentence. |
| `translate` | Returns the original text unchanged, `applied: false`, and a note explaining translation requires a connected AI provider — never fabricates a translation. |

Every branch is covered by `writingEngine.test.ts` (9 tests), including edge cases (empty input, an input of exactly two sentences for `shorten`).

## Why deterministic, not simulated AI

A tone/rewrite feature that silently pretended to be AI-generated while actually running fixed string transforms would be dishonest about its own capability. Every `WritingResult.note` says plainly what happened ("Text shortened to the first two sentences," "Translation requires a connected AI provider," etc.) and the Writing Studio's own page copy states up front: *"no AI provider connected yet, so every transform here is deterministic and clearly labeled as such."* This is the same honesty precedent as the Inventory Assistant's "Frequently Used Together" note and the CRM suggestions with `actionId: null` — never fabricate a capability the codebase doesn't actually have.

## UI surfaces

- **`WritingStudioModal.tsx`** — a reusable modal (`{ open, onClose, initialTaskType?, initialText?, onApply? }`) embedding a Type select, an Action select, a source textarea, a Run button, and the result. The "Apply" button only renders when the caller passed `onApply` **and** the result's `applied` is `true` — so a caller can never apply a `translate` result, since it was never actually transformed.
- **`WritingStudioView.tsx`** — the same UI as a standalone page at `/bloom-ai/writing-studio`, with no `onApply` (purely exploratory/copy-out use).
- **Proposal Assistant integration** — `ProposalGeneratorPanel.tsx` adds an "Improve with Bloom AI" button next to the Executive Summary heading (shown only while `proposal.status === "draft"`), opening `WritingStudioModal` pre-filled with the proposal's own executive summary as `initialText` and `initialTaskType="proposal"`. No `onApply` is wired here either — the modal is read-only/exploratory for a proposal in this checkpoint, consistent with "Improve Copy" being explicitly named a Proposal Assistant *capability* in the spec, not an auto-apply pipeline.

## Prompt Library integration

Opening any Prompt Library template's "Open in Writing Studio" link opens this same modal with the prompt's own text as `initialText` — the Prompt Library supplies starting text, the Writing Engine supplies the (deterministic) transform.

## Extension point for a real provider

When a real AI provider is eventually registered (out of scope for this checkpoint), `applyWritingAction` is the single seam to extend: `translate` becomes a real call, and `rewrite`/tone actions can be upgraded from fixed-phrase prepends to genuine generation — without any UI change, since every caller already handles `applied`/`note` generically.
