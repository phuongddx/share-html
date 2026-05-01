"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const MarkdownViewer = dynamic(
  () => import("@/components/markdown-viewer").then((m) => m.MarkdownViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    ),
  },
);

interface MarkdownViewerWrapperProps {
  content: string;
}

export function MarkdownViewerWrapper({ content }: MarkdownViewerWrapperProps) {
  return <MarkdownViewer content={content} />;
}
