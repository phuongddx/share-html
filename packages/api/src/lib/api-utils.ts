/**
 * Shared utilities for the v1 REST API routes (Hono-compatible).
 */

/** Extract client IP from proxy headers (Vercel / reverse proxy). */
export function getClientIp(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp;

  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded.split(",").map((s) => s.trim());
    return entries[entries.length - 1];
  }

  return "unknown";
}

/** Build the public share URL for a given slug. Caller provides the web domain. */
export function buildShareUrl(host: string, slug: string): string {
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}/s/${slug}`;
}
