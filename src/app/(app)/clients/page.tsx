import { ComingSoon } from "@/components/ui/ComingSoon";

export default function ClientsPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-text">Clients</h2>
      <div className="mt-6">
        <ComingSoon moduleLabel="Clients" />
      </div>
    </div>
  );
}
