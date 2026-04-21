"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { SearchResult } from "@/types/share";

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
}

/** Format an ISO date string as a relative time (e.g. "3 days ago"). */
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

/** Truncate text to a max length with ellipsis. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "\u2026";
}

function SkeletonCard() {
  return (
    <Card size="sm">
      <CardContent>
        <div className="space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <svg
        className="mb-4 size-12"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <p className="text-lg font-medium">No results found</p>
      <p className="text-sm">Try a different search term</p>
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
      {results.map((r) => (
        <Card key={r.slug} size="sm">
          <CardContent>
            <Link
              href={`/s/${r.slug}`}
              className="font-medium text-foreground hover:underline"
            >
              {r.filename}
            </Link>
            {r.snippet && (
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {truncate(r.snippet, 200)}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{relativeTime(r.created_at)}</span>
              <span>{r.view_count} view{r.view_count !== 1 ? "s" : ""}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
