import { notFound } from "next/navigation";
import { getMediaAssetById } from "@/lib/data";
import { AssetDetailView } from "@/modules/assets/components/AssetDetailView";

async function fetchAsset(id: string) {
  try {
    return await getMediaAssetById(id);
  } catch {
    return null;
  }
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await fetchAsset(id);
  if (!asset) notFound();
  return <AssetDetailView asset={asset} />;
}
