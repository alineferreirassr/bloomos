/**
 * One Daily Operations Brief generation attempt — metadata only, per the
 * checkpoint spec ("Do not store prompts"). Deliberately excludes the
 * brief's own content too, not only the prompt — the executive summary,
 * priorities, and every other narrative field never get persisted here,
 * matching the AI platform's standing rule against persisting generated
 * content (`docs/skills.md` §9's observability rule, applied to storage
 * instead of just logging).
 */
export interface DailyBriefExecution {
  id: string;
  workspace_id: string;
  status: "success" | "failure";
  provider: string;
  model: string | null;
  prompt_version: string;
  mock: boolean;
  latency_ms: number;
  generated_at: string;
  created_at: string;
}
