import type { ReferrerSource } from "@/types/analytics";

const REFERRER_RULES: Array<{ pattern: RegExp; source: ReferrerSource }> = [
  { pattern: /google\./i, source: "google" },
  { pattern: /bing\./i, source: "google" },
  { pattern: /twitter\.com|x\.com/i, source: "twitter" },
  { pattern: /slack\.com/i, source: "slack" },
  { pattern: /discord\.com/i, source: "discord" },
  { pattern: /github\.com/i, source: "github" },
  { pattern: /linkedin\.com/i, source: "other" },
  { pattern: /reddit\.com/i, source: "other" },
  { pattern: /facebook\.com/i, source: "other" },
];

/** Normalize raw referrer URL into a source enum for analytics grouping. */
export function parseReferrer(raw: string | null, embed: boolean): ReferrerSource {
  if (embed) return "embed";
  if (!raw) return "direct";
  try {
    const url = new URL(raw);
    if (url.host === process.env.NEXT_PUBLIC_APP_HOST) return "direct";
    for (const { pattern, source } of REFERRER_RULES) {
      if (pattern.test(url.host)) return source;
    }
    return "other";
  } catch {
    return "direct";
  }
}
