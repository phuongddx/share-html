/**
 * Extract plain text from HTML or Markdown for search indexing.
 * For markdown: strips fenced code blocks/inline code/headings/emphasis markers.
 * For HTML: removes script/style, replaces block elements with newlines, strips tags.
 * Limits output to 100KB.
 */

const MAX_TEXT_LENGTH = 100_000;

export function extractTextFromMarkdown(md: string): string {
  let text = md;
  // Remove fenced code blocks
  text = text.replace(/```[\s\S]*?```/g, "");
  // Remove inline code
  text = text.replace(/`[^`]*`/g, "");
  // Remove ATX headings markers
  text = text.replace(/^#{1,6}\s+/gm, "");
  // Remove bold/italic markers
  text = text.replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2");
  // Remove link syntax, keep display text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // Remove image syntax
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n");
  text = text.trim();
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

export function extractTextFromHtml(content: string): string {
  const html = content;
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
