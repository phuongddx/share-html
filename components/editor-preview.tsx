"use client";

import { forwardRef } from "react";
import { MarkdownViewer } from "@/components/markdown-viewer";
import type { HeadingInfo } from "@/lib/use-scroll-sync";

interface EditorPreviewProps {
  content: string;
  headings?: HeadingInfo[];
}

export const EditorPreview = forwardRef<HTMLDivElement, EditorPreviewProps>(
  function EditorPreview({ content, headings }, ref) {
    if (!content.trim()) {
      return (
        <div
          ref={ref}
          className="flex h-full items-center justify-center text-muted-foreground"
        >
          <p>Nothing to preview yet. Start writing on the left.</p>
        </div>
      );
    }

    return (
      <div ref={ref} className="h-full overflow-auto p-4">
        <MarkdownViewer content={content} headings={headings} />
      </div>
    );
  }
);
