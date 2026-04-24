/**
 * Validate editor content before publishing.
 */

const MAX_CONTENT_SIZE = 1024 * 1024; // 1MB

export function validateEditorContent(content: string): { valid: boolean; error?: string } {
  if (!content.trim()) {
    return { valid: false, error: "Content cannot be empty." };
  }

  if (content.length > MAX_CONTENT_SIZE) {
    return { valid: false, error: `Content exceeds 1MB limit (${(content.length / 1024 / 1024).toFixed(1)}MB).` };
  }

  return { valid: true };
}
