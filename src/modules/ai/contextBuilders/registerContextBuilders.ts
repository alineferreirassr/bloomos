import { registerAIContextBuilder } from "@/core/ai/context/registry";
import { workspaceContextBuilder } from "@/core/ai/context/builders/workspaceContextBuilder";
import { userContextBuilder } from "@/core/ai/context/builders/userContextBuilder";
import { eventContextBuilder } from "@/modules/ai/contextBuilders/eventContextBuilder";
import { clientContextBuilder } from "@/modules/ai/contextBuilders/clientContextBuilder";
import { eventServiceAssignmentContextBuilder } from "@/modules/ai/contextBuilders/eventServiceAssignmentContextBuilder";
import { proposalDetailsContextBuilder } from "@/modules/ai/contextBuilders/proposalDetailsContextBuilder";
import { dailyBriefContextBuilder } from "@/modules/ai/dailyBrief/dailyBriefContextBuilder";
import { memoryContextBuilder } from "@/core/ai/context/builders/memoryContextBuilder";
import { crmAssistantContextBuilder } from "@/modules/ai/crmAssistant/crmAssistantContextBuilder";
import { financeAssistantContextBuilder } from "@/modules/ai/financeAssistant/financeAssistantContextBuilder";
import { analyticsSummaryContextBuilder } from "@/modules/analytics/aiSummary/analyticsSummaryContextBuilder";

let registered = false;

/**
 * Idempotent — safe to call from every entry point that needs the
 * platform's context builders available, since a Server Action module can
 * be invoked many times per process and registration must not stack
 * duplicate work each time.
 */
export function registerDefaultAIContextBuilders(): void {
  if (registered) return;
  registerAIContextBuilder(workspaceContextBuilder);
  registerAIContextBuilder(userContextBuilder);
  registerAIContextBuilder(eventContextBuilder);
  registerAIContextBuilder(clientContextBuilder);
  registerAIContextBuilder(eventServiceAssignmentContextBuilder);
  registerAIContextBuilder(proposalDetailsContextBuilder);
  registerAIContextBuilder(dailyBriefContextBuilder);
  registerAIContextBuilder(memoryContextBuilder);
  registerAIContextBuilder(crmAssistantContextBuilder);
  registerAIContextBuilder(financeAssistantContextBuilder);
  registerAIContextBuilder(analyticsSummaryContextBuilder);
  registered = true;
}
