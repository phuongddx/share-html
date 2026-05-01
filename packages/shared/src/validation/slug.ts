/**
 * Validates a custom slug of the form "handle/filename".
 *
 * Pattern rules:
 *   handle  — 1-30 chars, alphanumeric and hyphens, must start/end alphanumeric
 *   filename — 1-100 chars, alphanumeric, hyphens, and dots, must start/end alphanumeric
 *   separator — single "/"
 */

const CUSTOM_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]\/[a-z0-9][a-z0-9-.]{0,98}[a-z0-9]$/;

/** Route prefixes that may not be used as a custom handle. */
const RESERVED_HANDLES = new Set([
  "api", "auth", "dashboard", "editor", "search", "s", "admin", "_next",
]);

export function validateCustomSlug(slug: string): { valid: boolean; error?: string } {
  if (!CUSTOM_SLUG_RE.test(slug)) {
    return { valid: false, error: "Invalid format. Use: handle/filename (lowercase, alphanumeric, hyphens)." };
  }

  const handle = slug.split("/")[0];
  if (RESERVED_HANDLES.has(handle)) {
    return { valid: false, error: `"${handle}" is a reserved handle and cannot be used.` };
  }

  return { valid: true };
}
