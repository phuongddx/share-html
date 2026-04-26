"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/search-bar";
import { SearchResults } from "@/components/search-results";
import type { SearchResult } from "@/types/share";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("q") ?? "";
  const trimmedParam = queryParam.trim();

  const [query, setQuery] = useState(trimmedParam);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync query from URL search params (primitive dependency)
  useEffect(() => {
    setQuery(trimmedParam);
  }, [trimmedParam]);

  const performSearch = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(term)}`,
        { signal: controller.signal },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Search failed");
        setResults([]);
        return;
      }
      const data = await res.json();
      setResults(data.results ?? []);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Network error. Please try again.");
      setResults([]);
    } finally {
      if (abortRef.current === controller) setIsLoading(false);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center bg-background">
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
