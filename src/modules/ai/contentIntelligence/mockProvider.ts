import type { AICompletion, AICompletionRequest, AIProvider } from "@/core/ai/types";
import type { ContentIntelligenceSourceContent, ContentIntelligenceBriefOutput } from "@/modules/ai/contentIntelligence/types";

const MOCK_MODEL_NAME = "content-intelligence-mock-v1";

/** Fields a Content Brief cares about, in priority order — deliberately generic across Idea/Inspiration/Script rather than hardcoding each domain's own field names here, since the source-fetching side (`analyzeContentAction.ts`) already normalizes them into this shared shape. */
const EXPECTED_FIELD_LABELS: Record<string, string> = {
  hook: "a defined hook",
  cta: "a defined call-to-action",
  audience: "a defined target audience",
  whyItWorks: "notes on why the source works",
  notes: "supporting notes",
  description: "a description",
  content: "written content",
};

const ENTITY_LABELS: Record<ContentIntelligenceSourceContent["sourceEntityType"], string> = {
  idea_item: "Idea",
  inspiration_item: "Inspiration reference",
  script_item: "Script",
};

/**
 * Pure and deterministic — the same `source` always produces the exact
 * same output, proving both "deterministic mock behavior" and giving the
 * adversarial-content tests something meaningful to assert on (a hostile
 * `source.fields.hook` value changes nothing about *how* this function
 * reasons, only the presence/length signal it reads off that field, the
 * same way `createMockAIProvider`'s own Event Operations Brief mock only
 * ever narrates already-computed structured facts).
 */
export function generateDeterministicBrief(source: ContentIntelligenceSourceContent | undefined): ContentIntelligenceBriefOutput {
  if (!source) {
    return {
      summary: "No source content was supplied.",
      hookSuggestions: ["Add source content before requesting a brief."],
      ctaSuggestions: [],
      audienceObservations: "No source content was supplied.",
      strengths: [],
      gaps: ["No source content was supplied."],
      recommendations: ["Regenerate this brief once source content is available."],
      confidence: 0,
    };
  }

  const entityLabel = ENTITY_LABELS[source.sourceEntityType];
  const presentKeys = Object.keys(EXPECTED_FIELD_LABELS).filter((key) => Boolean(source.fields[key]?.trim()));
  const missingKeys = Object.keys(EXPECTED_FIELD_LABELS).filter((key) => !presentKeys.includes(key));

  const hasHook = presentKeys.includes("hook");
  const hasCta = presentKeys.includes("cta");
  const hasAudience = presentKeys.includes("audience");

  const summary = `A ${entityLabel} titled "${source.title}" — ${presentKeys.length} of ${Object.keys(EXPECTED_FIELD_LABELS).length} tracked content signal(s) are already filled in.`;

  const hookSuggestions = hasHook
    ? [
        "Sharpen the existing hook — lead with the single most emotionally specific detail rather than a general statement.",
        "Test a shorter variant of the current hook for the first one to two seconds of attention.",
      ]
    : ["No hook is set yet — open with a concrete, specific detail rather than a general statement about the event or service."];

  const ctaSuggestions = hasCta
    ? ["Pair the existing CTA with a single, concrete next step the viewer can take immediately."]
    : ["No CTA is set yet — add one clear, low-friction next step for the viewer."];

  const audienceObservations = hasAudience
    ? `An audience is already defined for this ${entityLabel.toLowerCase()} — confirm the hook and CTA above both still speak directly to that audience.`
    : `No target audience is defined yet for this ${entityLabel.toLowerCase()} — naming one would sharpen every other suggestion above.`;

  const strengths = presentKeys.length > 0 ? presentKeys.map((key) => `Already has ${EXPECTED_FIELD_LABELS[key]}.`) : ["No content signals are filled in yet."];

  const gaps = missingKeys.length > 0 ? missingKeys.map((key) => `Missing ${EXPECTED_FIELD_LABELS[key]}.`) : ["No obvious content gaps — every tracked signal is present."];

  const recommendations: string[] = [];
  if (missingKeys.length > 0) {
    recommendations.push(`Fill in ${EXPECTED_FIELD_LABELS[missingKeys[0]]} next — it's the highest-leverage gap for this ${entityLabel.toLowerCase()}.`);
  }
  recommendations.push("Review this brief against the workspace's current content calendar before acting on it.");

  const confidence = Math.min(95, 40 + presentKeys.length * 10);

  return { summary, hookSuggestions, ctaSuggestions, audienceObservations, strengths, gaps, recommendations, confidence };
}

/**
 * Deterministic, provider-agnostic stand-in — no OpenAI/Anthropic/any
 * provider is wired into BloomOS yet (SOCIAL-09A confirmed this remains
 * true). Never registered into the global provider registry, mirroring
 * `createMockAIProvider`'s own precedent exactly; `analyzeContentAction.ts`
 * instantiates this directly and always reports `is_mock: true` alongside
 * it. Reads its input from `conversation.context.facts.contentIntelligence`
 * — the same `contextFactsKey` convention every other mock provider in this
 * codebase already uses — never by re-parsing the rendered prompt text.
 */
export function createContentIntelligenceMockProvider(): AIProvider {
  return {
    name: "content-intelligence-mock",
    async complete(request: AICompletionRequest): Promise<AICompletion> {
      const source = request.conversation.context.facts.contentIntelligence as ContentIntelligenceSourceContent | undefined;
      const output = generateDeterministicBrief(source);
      return { content: JSON.stringify(output), requiresApproval: false, model: MOCK_MODEL_NAME, finishReason: "stop" };
    },
  };
}
