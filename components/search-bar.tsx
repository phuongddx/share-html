"use client";

// NOTE: Import and render this component on the home page (app/page.tsx)
// as <SearchBar compact /> inside a div with mt-8 max-w-2xl mx-auto

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  /** Pre-fill the input (e.g. from URL query param) */
  initialValue?: string;
  /** Compact mode for inline home-page usage */
  compact?: boolean;
}

export function SearchBar({ initialValue = "", compact = false }: SearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Sync if initialValue changes externally (e.g. browser back/forward)
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const navigateToSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (trimmed.length < 2) return;
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    },
    [router],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setValue(next);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => navigateToSearch(next), 300);
    },
    [navigateToSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        if (timerRef.current) clearTimeout(timerRef.current);
        navigateToSearch(value);
      }
    },
    [navigateToSearch, value],
  );

  const handleClear = useCallback(() => {
    setValue("");
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={`relative ${compact ? "max-w-md" : "max-w-xl"} mx-auto w-full`}>
      {/* Search icon */}
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>

      <Input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search shared HTML files..."
        aria-label="Search shared HTML files"
        className={compact ? "h-9 pl-9 text-sm" : "h-11 pl-9 text-base"}
      />

      {/* Clear button */}
      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            className="size-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
