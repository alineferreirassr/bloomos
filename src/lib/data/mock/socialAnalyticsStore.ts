import type { SocialAccountMetricSnapshot, SocialPostMetricSnapshot } from "@/types/socialMetricSnapshot";

let postSnapshots: SocialPostMetricSnapshot[] = [];
let accountSnapshots: SocialAccountMetricSnapshot[] = [];

export function readPostMetricSnapshots(): SocialPostMetricSnapshot[] {
  return postSnapshots;
}

export function writePostMetricSnapshots(next: SocialPostMetricSnapshot[]): void {
  postSnapshots = next;
}

export function readAccountMetricSnapshots(): SocialAccountMetricSnapshot[] {
  return accountSnapshots;
}

export function writeAccountMetricSnapshots(next: SocialAccountMetricSnapshot[]): void {
  accountSnapshots = next;
}

export function resetSocialAnalyticsStore(): void {
  postSnapshots = [];
  accountSnapshots = [];
}
