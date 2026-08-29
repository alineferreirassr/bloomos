import type { ComponentType, SVGProps } from "react";
import type { CalendarEventCategory } from "@/core/calendar/types";
import { EventsIcon, TaskIcon, DeadlineIcon } from "@/components/ui/icons";
import type { BadgeTone } from "@/components/ui/Badge";

/**
 * Advanced Calendar phase — the one small, closed icon/color mapping every
 * view (Month/Week/Day/Agenda) shares for `CalendarEventCategory`, reusing
 * Amoré Bloom's existing accent/success/warning tokens rather than a
 * separate rainbow palette.
 */
export const CATEGORY_ICON: Record<CalendarEventCategory, ComponentType<SVGProps<SVGSVGElement>>> = {
  event: EventsIcon,
  task: TaskIcon,
  deadline: DeadlineIcon,
};

export const CATEGORY_LABEL: Record<CalendarEventCategory, string> = {
  event: "Event",
  task: "Task",
  deadline: "Deadline",
};

export const CATEGORY_BADGE_TONE: Record<CalendarEventCategory, BadgeTone> = {
  event: "accent",
  task: "success",
  deadline: "warning",
};

export const CATEGORY_DOT_CLASS: Record<CalendarEventCategory, string> = {
  event: "bg-accent",
  task: "bg-success",
  deadline: "bg-warning",
};

/** The icon/text color for a category, used wherever an icon or label needs to read as "this category" without a full Badge. */
export const CATEGORY_TEXT_CLASS: Record<CalendarEventCategory, string> = {
  event: "text-accent",
  task: "text-success",
  deadline: "text-warning",
};

/** A small tinted chip (background + text) for a Month cell's per-entry row — "icon + subtle label," never a bare colored speck. */
export const CATEGORY_CHIP_CLASS: Record<CalendarEventCategory, string> = {
  event: "bg-accent-100 text-accent",
  task: "bg-success/12 text-success",
  deadline: "bg-warning/12 text-warning",
};
