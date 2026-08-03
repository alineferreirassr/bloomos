import { EditVendorView } from "@/modules/vendors/components/EditVendorView";

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditVendorView vendorId={id} />;
}
