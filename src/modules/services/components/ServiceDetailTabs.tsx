import { Tab, TabList } from "@/components/ui/Tabs";

export const SERVICE_DETAIL_TAB_VALUES = ["overview", "templates", "versions", "assignments", "health", "notes", "timeline"] as const;
export type ServiceDetailTabValue = (typeof SERVICE_DETAIL_TAB_VALUES)[number];

const TAB_LABELS: Record<ServiceDetailTabValue, string> = {
  overview: "Overview",
  templates: "Templates",
  versions: "Versions",
  assignments: "Assignments",
  health: "Health",
  notes: "Notes",
  timeline: "Timeline",
};

export function isServiceDetailTabValue(value: string): value is ServiceDetailTabValue {
  return (SERVICE_DETAIL_TAB_VALUES as readonly string[]).includes(value);
}

/**
 * Every tab stays clickable — none is disabled — even though only Overview
 * has real content this checkpoint. A direct link to `?tab=templates` (or
 * Back/Forward landing on it) should reach the same honest "coming soon"
 * panel a click would, never a dead button. The parent `<Tabs>` owns
 * `value`/`onValueChange`; this component only renders the tab strip.
 */
export function ServiceDetailTabs() {
  return (
    <TabList aria-label="Service detail sections">
      {SERVICE_DETAIL_TAB_VALUES.map((value) => (
        <Tab key={value} value={value}>
          {TAB_LABELS[value]}
        </Tab>
      ))}
    </TabList>
  );
}
