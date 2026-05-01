import type { Share } from "@dropitx/shared/types/share";

/**
 * Extract slug from a URL matching /s/[slug] path pattern.
 * Validates only the path — no strict origin check (Red Team Fix: 14).
 */
export function parseOembedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/s\/([a-zA-Z0-9_-]{1,20})$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function buildOembedResponse(
  share: Share & { display_name?: string | null },
  siteUrl: string,
  ogImageUrl: string,
): Record<string, unknown> {
  const title = share.title ?? share.filename;
  const shareUrl = `${siteUrl}/s/${share.slug}`;

  // Red Team Fix: 5, 6 — Return generic response for restricted shares
  if (share.is_private || !!share.password_hash) {
    return {
      type: "rich",
      version: "1.0",
      title: "Protected DropItX Document",
      author_name: "DropItX",
      provider_name: "DropItX",
      provider_url: siteUrl,
      thumbnail_url: ogImageUrl,
      thumbnail_width: 1200,
      thumbnail_height: 630,
      url: shareUrl,
      html: `<iframe src="${siteUrl}/embed/${share.slug}" width="600" height="400" frameborder="0" allowfullscreen loading="lazy" title="Protected content"></iframe>`,
      width: 600,
      height: 400,
    };
  }

  return {
    type: "rich",
    version: "1.0",
    title,
    author_name: share.display_name ?? "Anonymous",
    provider_name: "DropItX",
    provider_url: siteUrl,
    thumbnail_url: ogImageUrl,
    thumbnail_width: 1200,
    thumbnail_height: 630,
    url: shareUrl,
    html: `<iframe src="${siteUrl}/embed/${share.slug}" width="600" height="400" frameborder="0" allowfullscreen loading="lazy" title="${title}"></iframe>`,
    width: 600,
    height: 400,
  };
}
