"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PasswordGateProps {
  slug: string;
  title: string;
}

export function PasswordGate({ slug, title }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/shares/${slug}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.reload();
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setError("Too many attempts. Try again later.");
      } else if (res.status === 401) {
        setRemaining(typeof data.remaining === "number" ? data.remaining : null);
        setError("Wrong password.");
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm border border-border rounded-lg p-8">
        <div className="flex flex-col items-center gap-5">
          <p className="font-mono text-2xl font-semibold tracking-tight">
            {">"} unlock
          </p>

          <p className="text-sm text-muted-foreground truncate max-w-[240px] text-center">
            {title}
          </p>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
            <Input
              ref={inputRef}
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              className="h-10 rounded-md"
            />
            <Button type="submit" disabled={loading || !password} className="w-full rounded-md">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Unlocking…
                </>
              ) : (
                "Unlock"
              )}
            </Button>
          </form>

          {error && (
            <p className="text-sm text-destructive text-center">
              {error}
              {remaining !== null && remaining > 0 && (
                <span className="text-muted-foreground"> ({remaining} attempt{remaining !== 1 ? "s" : ""} left)</span>
              )}
            </p>
          )}

          <div className="flex items-center gap-3 w-full">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <a
            href={`/auth/login?next=/s/${slug}`}
            className="text-sm text-primary hover:underline"
          >
            Sign in to view
          </a>
        </div>
      </div>
    </div>
  );
}
