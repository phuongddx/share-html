/**
 * Extract plain text from HTML for search indexing.
 * Removes script/style content, replaces block elements with newlines,
 * strips remaining tags, and limits output to 100KB.
 */

const MAX_TEXT_LENGTH = 100_000;

export function extractTextFromHtml(html: string): string {
  // Remove script and style tags including their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Replace self-closing block elements with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<hr\s*\/?>/gi, "\n");

  // Add newlines after closing block tags
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article|header|footer|main|nav|aside|figure|figcaption|details|summary|pre|address)>/gi, "\n");

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Collapse whitespace while preserving intentional newlines
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n");
  text = text.trim();

  // Limit to MAX_TEXT_LENGTH characters
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH);
  }

  return text;
}
