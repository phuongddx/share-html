"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  initialValue?: string;
  compact?: boolean;
}

export function SearchBar({ initialValue = "", compact = false }: SearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={`relative ${compact ? "max-w-md" : "max-w-xl"} mx-auto w-full`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />

      <Input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search shared files..."
        aria-label="Search shared files"
        className={compact ? "h-10 pl-9 text-sm" : "h-11 pl-9 text-base"}
      />

      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
