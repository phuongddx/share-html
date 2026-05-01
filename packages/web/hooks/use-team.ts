"use client";

import { useState, useCallback } from "react";

interface Team {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  plan: string;
  created_at: string;
  role?: string;
  user?: { id: string; email?: string } | null;
}

/**
 * Hook to access the currently selected team from local storage.
 * Used by team-related form components.
 */
export function useTeam() {
  const [team, setTeam] = useState<Team | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("selectedTeam");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const selectTeam = useCallback((t: Team | null) => {
    setTeam(t);
    if (t) {
      localStorage.setItem("selectedTeam", JSON.stringify(t));
    } else {
      localStorage.removeItem("selectedTeam");
    }
  }, []);

  return { team, selectTeam };
}
