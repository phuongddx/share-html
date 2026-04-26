"use client";

import { useEffect } from "react";
import { trackEvent, AnalyticsEvent } from "@/lib/analytics";

export function ShareViewedTracker() {
  useEffect(() => {
    trackEvent(AnalyticsEvent.SHARE_VIEWED);
  }, []);
  return null;
}
