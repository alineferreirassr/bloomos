import { ReportDetailView } from "@/modules/reporting/components/ReportDetailView";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportDetailView reportId={id} />;
}
