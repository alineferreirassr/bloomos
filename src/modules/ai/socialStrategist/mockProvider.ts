import type { AICompletion, AICompletionRequest, AIProvider } from "@/core/ai/types";
import type { SocialStrategistContext, SocialStrategistModelOutput } from "@/modules/ai/socialStrategist/types";

const MOCK_MODEL_NAME = "bloomos-social-strategist-mock-v1";

function emptyOutput(): SocialStrategistModelOutput {
  return {
    accountObservations: [],
    contentOpportunities: [],
    contentPillars: [],
    nextContentRecommendations: [],
    postingStrategyNotes: [],
    audienceObservations: [],
    referencedContent: [],
    conversionObservations: [],
    dataSufficiencyNotes: ["No Social context was supplied."],
    confidence: 0,
  };
}

/**
 * SOCIAL-14C — deterministic mock for the Social Strategist Skill, same
 * rationale as `crmAssistant/mockProvider.ts`: never registered into the
 * global provider registry (only ever returned from
 * `SkillDefinition.createMockProvider`, used when `isAIConfigured()` is
 * false — i.e. always, in this checkpoint, since no real provider exists),
 * always reflects the supplied context's own real data rather than a fixed
 * string. Every id referenced below (`relatedPostId`, `relatedIdeaId`,
 * `referencedContent[].id`) is a real id read straight off the context, so
 * this mock's own output always survives `semanticValidation.ts` — the
 * same guarantee `createCrmAssistantMockProvider`'s own tests rely on.
 */
export function createSocialStrategistMockProvider(): AIProvider {
  return {
    name: "mock",
    async complete(request: AICompletionRequest): Promise<AICompletion> {
      const context = request.conversation.context.facts.socialStrategistContext as SocialStrategistContext | undefined;

      if (!context) {
        return { content: JSON.stringify(emptyOutput()), requiresApproval: true, model: MOCK_MODEL_NAME, finishReason: "error" };
      }

      const dataSufficiencyNotes: string[] = [];
      if (context.posts.length === 0) dataSufficiencyNotes.push("No Social posts exist yet — no post-performance observations are possible.");
      if (context.accountMetrics === null) dataSufficiencyNotes.push("No Instagram account is connected, or no account-level analytics have synced yet.");
      if (context.instagramLeads.length === 0) dataSufficiencyNotes.push("No Instagram-sourced Leads exist yet — no conversion observations are possible.");
      for (const category of context.unavailableCategories) {
        dataSufficiencyNotes.push(`Could not read "${category}" data for this report — it was temporarily unavailable.`);
      }

      const accountObservations: string[] = [];
      if (context.accountMetrics?.latest) {
        const { reach, profileViews, metricDate } = context.accountMetrics.latest;
        if (reach !== null) accountObservations.push(`As of ${metricDate}, the connected Instagram account reached ${reach} account(s).`);
        if (profileViews !== null) accountObservations.push(`As of ${metricDate}, the account received ${profileViews} profile view(s).`);
      }
      if (context.posts.length > 0) {
        accountObservations.push(`${context.postCountByStatus.published} of ${context.posts.length} tracked post(s) are published.`);
      }

      const contentOpportunities = context.topPosts.slice(0, 5).map((post) => ({
        label: `Build on the momentum of your top-performing post`,
        reason: `This post had ${post.totalInteractions} real total interaction(s), the highest among tracked posts.`,
        relatedPostId: post.postId,
        relatedIdeaId: null,
      }));

      const formatCounts = new Map<string, number>();
      for (const idea of context.ideas) {
        if (!idea.contentFormat) continue;
        formatCounts.set(idea.contentFormat, (formatCounts.get(idea.contentFormat) ?? 0) + 1);
      }
      const contentPillars = [...formatCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([format, count]) => ({ name: format, rationale: `${count} Idea(s) already planned in this format.` }));

      const nextContentRecommendations = context.ideas
        .filter((idea) => idea.status === "active")
        .slice(0, 10)
        .map((idea) => ({
          label: `Move "${idea.title}" into production`,
          reason: "This Idea is already active and not yet produced.",
          suggestedFormat: idea.contentFormat,
          relatedIdeaId: idea.ideaId,
          relatedInspirationId: null,
        }));

      const postingStrategyNotes: string[] = [];
      if (context.posts.length > 0) {
        postingStrategyNotes.push(`${context.postCountByStatus.scheduled} post(s) currently scheduled, ${context.postCountByStatus.draft} still in draft.`);
      }

      const audienceObservations = context.ideas
        .filter((idea) => idea.audience !== null)
        .slice(0, 5)
        .map((idea) => `An existing Idea ("${idea.title}") names its audience as: ${idea.audience}.`);

      const referencedContent = [
        ...context.topPosts.slice(0, 3).map((post) => ({ type: "post" as const, id: post.postId, note: "A top-performing tracked post." })),
        ...context.ideas.slice(0, 3).map((idea) => ({ type: "idea" as const, id: idea.ideaId, note: "An existing planned Idea." })),
      ].slice(0, 15);

      const conversionObservations: string[] = [];
      if (context.instagramLeads.length > 0) {
        conversionObservations.push(`${context.instagramLeads.length} Instagram-sourced Lead(s) tracked; ${context.unassignedInstagramLeadCount} currently unassigned.`);
      }

      const realDataPoints = context.posts.length + context.ideas.length + context.inspiration.length + context.instagramLeads.length + (context.accountMetrics ? 1 : 0);
      const confidence = Math.min(100, Math.max(0, realDataPoints === 0 ? 0 : 30 + Math.min(70, realDataPoints * 3)));

      const output: SocialStrategistModelOutput = {
        accountObservations,
        contentOpportunities,
        contentPillars,
        nextContentRecommendations,
        postingStrategyNotes,
        audienceObservations,
        referencedContent,
        conversionObservations,
        dataSufficiencyNotes,
        confidence,
      };

      return { content: JSON.stringify(output), requiresApproval: true, model: MOCK_MODEL_NAME, finishReason: "stop" };
    },
  };
}
