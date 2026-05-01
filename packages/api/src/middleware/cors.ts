import { cors as honoCors } from "hono/cors";

/**
 * CORS middleware. Origin MUST be set explicitly per environment.
 * Never defaults to '*'. In dev, Next.js rewrite proxy handles
 * same-origin requests so CORS is only needed for direct API access
 * (mobile, external clients).
 */
export function cors() {
  const origin = process.env.CORS_ORIGIN;

  if (!origin && process.env.NODE_ENV !== "test") {
    console.warn("[cors] CORS_ORIGIN not set -- cross-origin requests will be rejected");
  }

  return honoCors({
    origin: origin ?? "",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
  });
}
