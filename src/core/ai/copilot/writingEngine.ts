/**
 * Checkpoint 20, Step 9 — the Writing Engine. This checkpoint's own stop
 * condition forbids connecting a real AI provider ("Do NOT implement
 * external AI providers yet"), so true generative rewriting/translation is
 * out of scope — every transform here is a plain, deterministic text
 * operation, honestly labeled as such (`applied: false` for the two
 * actions — `translate`, `grammar`-as-correction — that genuinely need a
 * real language model to do properly; `grammar` here only does the
 * mechanical normalization a regex can safely do). This mirrors the same
 * "mock provider is a deterministic stand-in, never a fake LLM response"
 * principle every other Skill's `createMockProvider` already follows.
 */
export const WRITING_TASK_TYPES = [
  "proposal",
  "email",
  "contract",
  "follow_up",
  "reminder",
  "invoice_notes",
  "client_message",
  "internal_notes",
] as const;
export type WritingTaskType = (typeof WRITING_TASK_TYPES)[number];

export const WRITING_TASK_LABELS: Record<WritingTaskType, string> = {
  proposal: "Proposal",
  email: "Email",
  contract: "Contract",
  follow_up: "Follow Up",
  reminder: "Reminder",
  invoice_notes: "Invoice Notes",
  client_message: "Client Message",
  internal_notes: "Internal Notes",
};

export const WRITING_ACTIONS = ["rewrite", "shorten", "luxury_tone", "professional_tone", "friendly_tone", "translate", "grammar"] as const;
export type WritingAction = (typeof WRITING_ACTIONS)[number];

export const WRITING_ACTION_LABELS: Record<WritingAction, string> = {
  rewrite: "Rewrite",
  shorten: "Shorten",
  luxury_tone: "Luxury Tone",
  professional_tone: "Professional Tone",
  friendly_tone: "Friendly Tone",
  translate: "Translate",
  grammar: "Grammar",
};

export interface WritingRequest {
  taskType: WritingTaskType;
  action: WritingAction;
  sourceText: string;
}

export interface WritingResult {
  outputText: string;
  action: WritingAction;
  /** `false` when this action genuinely needs a connected AI provider to do honestly — the output text is then just the original, unmodified. */
  applied: boolean;
  note: string | null;
}

function collapseWhitespace(text: string): string {
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function capitalizeSentences(text: string): string {
  return splitSentences(text)
    .map((sentence) => sentence.charAt(0).toUpperCase() + sentence.slice(1))
    .join(" ");
}

const LUXURY_OPENERS = ["With warmest regards,", "It would be our privilege to", "We are delighted to share that"];
const PROFESSIONAL_OPENERS = ["Please note:", "For your reference,", "To confirm,"];
const FRIENDLY_OPENERS = ["Just a quick note —", "Hi there!", "Happy to share —"];

function applyToneFraming(text: string, openers: string[]): string {
  const cleaned = collapseWhitespace(text);
  if (cleaned.length === 0) return cleaned;
  const opener = openers[0];
  return `${opener} ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
}

/**
 * The one entry point every Writing Studio surface calls (`WritingStudioModal.tsx`,
 * the Proposal Assistant's own "Rewrite" buttons). Deterministic, synchronous
 * — no network call, so it's safe to run on every keystroke's debounced
 * preview without a loading state.
 */
export function applyWritingAction(request: WritingRequest): WritingResult {
  const { action, sourceText } = request;
  const cleaned = collapseWhitespace(sourceText);

  switch (action) {
    case "shorten": {
      const sentences = splitSentences(cleaned);
      const kept = sentences.slice(0, 2).join(" ");
      return { outputText: kept || cleaned, action, applied: true, note: sentences.length > 2 ? `Kept the first 2 of ${sentences.length} sentences.` : null };
    }
    case "grammar": {
      const normalized = capitalizeSentences(cleaned);
      return { outputText: normalized, action, applied: true, note: "Whitespace and sentence capitalization normalized. This is mechanical cleanup, not full grammar correction." };
    }
    case "luxury_tone":
      return { outputText: applyToneFraming(cleaned, LUXURY_OPENERS), action, applied: true, note: null };
    case "professional_tone":
      return { outputText: applyToneFraming(cleaned, PROFESSIONAL_OPENERS), action, applied: true, note: null };
    case "friendly_tone":
      return { outputText: applyToneFraming(cleaned, FRIENDLY_OPENERS), action, applied: true, note: null };
    case "rewrite":
      return { outputText: capitalizeSentences(cleaned), action, applied: true, note: "A light structural cleanup — full generative rewriting needs a connected AI provider." };
    case "translate":
      return { outputText: cleaned, action, applied: false, note: "Translation requires a connected AI provider, which isn't configured in this environment." };
    default:
      return { outputText: cleaned, action, applied: false, note: null };
  }
}
