"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

function beforeSend(event: BeforeSendEvent) {
  try {
    const url = new URL(event.url);
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return event;
  }
}

export function VercelAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
