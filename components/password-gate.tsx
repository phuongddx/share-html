"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-5 pt-8 pb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="size-6 text-muted-foreground" />
          </div>

          <div className="text-center space-y-1">
            <p className="font-semibold">This content is protected</p>
            <p className="text-sm text-muted-foreground truncate max-w-[240px]">{title}</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
            <Input
              ref={inputRef}
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
            <Button type="submit" disabled={loading || !password} className="w-full">
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
        </CardContent>
      </Card>
    </div>
  );
}
