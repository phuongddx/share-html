"use client";

import { useEffect } from "react";
import { trackEvent, AnalyticsEvent } from "@/lib/analytics";

interface EmbedViewedTrackerProps {
  slug: string;
}

export function EmbedViewedTracker({ slug }: EmbedViewedTrackerProps) {
  useEffect(() => {
    trackEvent(AnalyticsEvent.EMBED_VIEWED, { slug, source: "embed" });
  }, [slug]);
  return null;
}
