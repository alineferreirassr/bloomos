import { ComingSoon } from "@/components/ui/ComingSoon";

export default function LeadsPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-text">Leads</h2>
      <div className="mt-6">
        <ComingSoon moduleLabel="Leads" />
      </div>
    </div>
  );
}
