"use client";

import { useEffect, useRef } from "react";

interface ShareAnalyticsTrackerProps {
  shareId: string;
  trackingToken: string;
}

/**
 * Client-side tracker that sends a signed token + client referrer to the
 * analytics endpoint. Does NOT increment view_count — server already did that.
 */
export function ShareAnalyticsTracker({ shareId, trackingToken }: ShareAnalyticsTrackerProps) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current || !trackingToken) return;
    sent.current = true;

    const isEmbed = window.parent !== window;

    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackingToken,
        shareId,
        referrer: document.referrer || null,
        isEmbed,
      }),
      keepalive: true,
    }).catch(() => {
      // Analytics must never break UX
    });
  }, [shareId, trackingToken]);

  return null;
}
