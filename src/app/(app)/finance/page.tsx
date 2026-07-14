import { ComingSoon } from "@/components/ui/ComingSoon";

export default function FinancePage() {
  return (
    <div>
      <h2 className="text-3xl font-semibold text-text">Finance</h2>
      <div className="mt-6">
        <ComingSoon moduleLabel="Finance" />
      </div>
    </div>
  );
}
