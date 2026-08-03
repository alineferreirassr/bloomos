"use client";

import { useState } from "react";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotificationCenterPanel } from "@/modules/communication/notifications/components/NotificationCenterPanel";
import { ActivityFeedPanel } from "@/modules/communication/activityFeed/components/ActivityFeedPanel";
import { AnnouncementsPanel } from "@/modules/communication/announcements/components/AnnouncementsPanel";
import { RemindersPanel } from "@/modules/communication/reminders/components/RemindersPanel";
import { NotificationPreferencesPanel } from "@/modules/communication/preferences/components/NotificationPreferencesPanel";

const TABS = ["notifications", "activity", "announcements", "reminders", "preferences"] as const;
type CommunicationsTab = (typeof TABS)[number];

const TAB_LABELS: Record<CommunicationsTab, string> = {
  notifications: "Notifications",
  activity: "Activity Feed",
  announcements: "Announcements",
  reminders: "Reminders",
  preferences: "Preferences",
};

/**
 * v2.0 Checkpoint 24 — the `/communications` hub: Notification Center
 * (Step 1), Activity Feed (Step 7), Announcements (Step 8), Reminders
 * (Step 9), and Notification Preferences (Step 3), one shared `Tabs`
 * component per Checkpoint 15's own convention.
 */
export function CommunicationsView() {
  const [tab, setTab] = useState<CommunicationsTab>("notifications");
  const session = useMemberSession();
  const canManageAnnouncements = session.can("communications.manage");
  const currentMemberId = session.membership?.id ?? "";

  return (
    <div className="space-y-6">
      <PageHeader title="Communications" subtitle="Notifications, activity, announcements, and reminders across the whole workspace." />
      <Tabs value={tab} onValueChange={(value) => setTab(value as CommunicationsTab)}>
        <TabList aria-label="Communications sections">
          {TABS.map((t) => (
            <Tab key={t} value={t}>
              {TAB_LABELS[t]}
            </Tab>
          ))}
        </TabList>
        <TabPanel value="notifications" className="mt-4">
          <NotificationCenterPanel />
        </TabPanel>
        <TabPanel value="activity" className="mt-4">
          <ActivityFeedPanel />
        </TabPanel>
        <TabPanel value="announcements" className="mt-4">
          <AnnouncementsPanel currentMemberId={currentMemberId} canManage={canManageAnnouncements} />
        </TabPanel>
        <TabPanel value="reminders" className="mt-4">
          <RemindersPanel />
        </TabPanel>
        <TabPanel value="preferences" className="mt-4">
          <NotificationPreferencesPanel />
        </TabPanel>
      </Tabs>
    </div>
  );
}
