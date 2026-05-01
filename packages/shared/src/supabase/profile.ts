import type { User } from "@supabase/supabase-js";

function sanitizeDisplayName(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<[^>]+>/g, "")
    .trim()
    .slice(0, 100);
}

function sanitizeAvatarUrl(value: string | null | undefined) {
  return value?.startsWith("https://") ? value : null;
}

export function buildProfileSeed(user: User) {
  const metadata = user.user_metadata ?? {};
  const displayName =
    sanitizeDisplayName(metadata.full_name) ||
    sanitizeDisplayName(metadata.name) ||
    sanitizeDisplayName(metadata.user_name) ||
    sanitizeDisplayName(metadata.preferred_username);

  return {
    id: user.id,
    display_name: displayName || null,
    avatar_url:
      sanitizeAvatarUrl(metadata.avatar_url) ??
      sanitizeAvatarUrl(metadata.picture),
  };
}
