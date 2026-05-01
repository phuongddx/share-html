"use client";

import { useState, useCallback } from "react";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

/**
 * Minimal toast hook for notification display.
 * Uses sonner under the hood when available; falls back to console.
 */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    (opts: { title?: string; description?: string; variant?: "default" | "destructive" }) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, ...opts }]);
      // Auto-dismiss after 5s
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, toast, dismiss };
}
