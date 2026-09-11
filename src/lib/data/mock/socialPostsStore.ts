import type { SocialPost } from "@/types/socialPost";

let socialPosts: SocialPost[] = [];

export function readSocialPosts(): SocialPost[] {
  return socialPosts;
}

export function writeSocialPosts(next: SocialPost[]): void {
  socialPosts = next;
}

export function resetSocialPostsStore(): void {
  socialPosts = [];
}
