/**
 * Converts a display name into a URL-safe slug for @handle URLs.
 * Falls back to a truncated user ID when the result would be empty.
 */
export function slugifyHandle(displayName: string, fallbackId: string): string {
  const slug = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

  return slug || `user-${fallbackId.slice(0, 8)}`;
}
