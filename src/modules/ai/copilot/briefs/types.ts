/** One rendered line in a Brief — always a complete, natural-language sentence, never a bare number, per Checkpoint 20 Step 4's own "use natural language" requirement. */
export interface BriefLine {
  id: string;
  text: string;
  tone: "info" | "success" | "warning";
}

export interface ExecutiveBrief {
  greeting: string;
  summary: string;
  lines: BriefLine[];
  recommendations: string[];
  generatedAt: string;
}

export interface TeamBrief {
  greeting: string;
  summary: string;
  lines: BriefLine[];
  generatedAt: string;
}

export interface ClientBrief {
  greeting: string;
  summary: string;
  lines: BriefLine[];
  nextStep: string | null;
  generatedAt: string;
}

/** v2.0 Checkpoint 24, Step 14 — Bloom AI Communication Intelligence. Same shape discipline as `ExecutiveBrief`/`TeamBrief` — every `line` is a plain template over already-computed facts, never an LLM call. */
export interface CommunicationBrief {
  greeting: string;
  summary: string;
  lines: BriefLine[];
  criticalIssueCount: number;
  pendingReplyCount: number;
  generatedAt: string;
}
