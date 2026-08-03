import { SearchResultsView } from "@/modules/search/components/SearchResultsView";

export default async function SearchResultsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <SearchResultsView initialQuery={q ?? ""} />;
}
