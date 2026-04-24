/**
 * Shared utilities for the v1 REST API routes.
 */

import { type NextRequest } from "next/server";

/** Extract client IP from proxy headers (Vercel / reverse proxy). */
export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded.split(",").map((s) => s.trim());
    return entries[entries.length - 1];
  }

  return "unknown";
}

/** Build the public share URL for a given slug. */
export function buildShareUrl(request: NextRequest, slug: string): string {
  const origin = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  return `${protocol}://${origin}/s/${slug}`;
}
