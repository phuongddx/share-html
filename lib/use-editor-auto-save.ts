"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "share-html-editor-draft";
const DEBOUNCE_MS = 3000;

interface AutoSaveResult {
  savedAt: Date | null;
  hasDraft: boolean;
  clearDraft: () => void;
  restoreDraft: () => string | null;
}

export function useEditorAutoSave(content: string): AutoSaveResult {
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      setHasDraft(existing !== null && existing.length > 0);
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Debounced save
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (content.length === 0) {
      return;
    }

    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, content);
        setSavedAt(new Date());
        setHasDraft(true);
      } catch {
        // storage full or unavailable
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setHasDraft(false);
      setSavedAt(null);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const restoreDraft = useCallback((): string | null => {
    try {
      const draft = localStorage.getItem(STORAGE_KEY);
      return draft;
    } catch {
      return null;
    }
  }, []);

  return { savedAt, hasDraft, clearDraft, restoreDraft };
}
