"use client";

import { track } from "@vercel/analytics";

export const AnalyticsEvent = {
  DOCUMENT_UPLOADED: "document_uploaded",
  CONTENT_PUBLISHED: "content_published",
  SHARE_VIEWED: "share_viewed",
  EMBED_VIEWED: "embed_viewed",
  ANALYTICS_VIEWED: "analytics_viewed",
} as const;

type EventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

const THROTTLE_MS = 5000;
const lastSent = new Map<string, number>();

export function trackEvent(
  name: EventName,
  props?: Record<string, string | number | boolean>,
) {
  try {
    const now = Date.now();
    const last = lastSent.get(name) ?? 0;
    if (now - last < THROTTLE_MS) return;
    lastSent.set(name, now);
    track(name, props);
  } catch {
    // Analytics must never break user flows
  }
}
