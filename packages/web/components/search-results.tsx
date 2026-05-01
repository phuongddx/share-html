"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Search, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResult } from "@dropitx/shared/types/share";

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

function getFileExtension(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "md") return { icon: <FileText className="size-4 text-primary" />, label: "MD" };
  return { icon: <FileText className="size-4 text-primary" />, label: "HTML" };
}

function SkeletonCard() {
  return (
    <Card size="sm">
      <CardContent>
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-fade-in">
      <Search className="mb-4 size-12 opacity-30" />
      <p className="text-lg font-medium">No results found</p>
      <p className="mt-1 text-sm">Try different keywords or check spelling</p>
    </div>
  );
}

export function SearchResults({ results, isLoading }: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (results.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      {results.map((r) => {
        const fileInfo = getFileExtension(r.filename);
        return (
          <Card
            key={r.slug}
            size="sm"
            className="transition-colors duration-200 hover:bg-muted/50 cursor-pointer group/card"
          >
            <CardContent>
              <Link
                href={`/s/${r.slug}`}
                className="flex items-start gap-3"
              >
                <div className="mt-0.5 shrink-0">{fileInfo.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground group-hover/card:text-primary transition-colors truncate">
                      {r.filename}
                    </span>
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground">
                      {fileInfo.label}
                    </span>
                  </div>
                  {r.snippet && (
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {truncate(r.snippet, 200)}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{relativeTime(r.created_at)}</span>
                    <span>{r.view_count} view{r.view_count !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
