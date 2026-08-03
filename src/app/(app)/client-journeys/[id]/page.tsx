import { JourneyDetailView } from "@/modules/clientJourney/components/JourneyDetailView";
import { parseJourneyRouteId } from "@/modules/clientJourney/journeyRoute";
import { EmptyState } from "@/components/ui/EmptyState";
import { CrmIcon } from "@/components/ui/icons";

export default async function ClientJourneyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = parseJourneyRouteId(id);
  if (!parsed) return <EmptyState title="This journey isn't available" description="The journey link is invalid." icon={CrmIcon} />;
  return <JourneyDetailView subjectType={parsed.subjectType} subjectId={parsed.subjectId} />;
}
