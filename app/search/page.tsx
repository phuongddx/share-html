"use client";

import { useCallback, useEffect, useState } from "react";
import { SearchBar } from "@/components/search-bar";
import { SearchResults } from "@/components/search-results";
import type { SearchResult } from "@/types/share";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve searchParams promise on mount
  useEffect(() => {
    searchParams.then((params) => {
      const q = (params.q ?? "").trim();
      setQuery(q);
    });
  }, [searchParams]);

  const performSearch = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(term)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Search failed");
        setResults([]);
        return;
      }
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setError("Network error. Please try again.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Re-search when query changes
  useEffect(() => {
    if (query.length === 0) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    performSearch(query);
  }, [query, performSearch]);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Search
        </h1>

        <SearchBar initialValue={query} />

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <SearchResults results={results} isLoading={isLoading} />
      </main>
    </div>
  );
}
