/**
 * Extract title from markdown content.
 * Priority: first H1 heading > filename without extension > "Untitled"
 */

export function extractTitleFromMarkdown(content: string, filename?: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim().slice(0, 255);

  if (filename) {
    const name = filename.replace(/\.(md|markdown|txt)$/i, "");
    if (name) return name.slice(0, 255);
  }

  return "Untitled";
}
