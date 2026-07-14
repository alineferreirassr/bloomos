import { ComingSoon } from "@/components/ui/ComingSoon";

export default function EventsPage() {
  return (
    <div>
      <h2 className="text-3xl font-semibold text-text">Events</h2>
      <div className="mt-6">
        <ComingSoon moduleLabel="Events" />
      </div>
    </div>
  );
}
