import { VendorDetailView } from "@/modules/vendors/components/VendorDetailView";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <VendorDetailView key={id} vendorId={id} />;
}
