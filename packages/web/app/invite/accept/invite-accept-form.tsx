"use client";

/**
 * Client component for the invite acceptance action.
 * POSTs to the accept API endpoint and redirects to the team dashboard.
 * Only needs teamSlug (for redirect) and token (for the API call).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface InviteAcceptFormProps {
  teamSlug: string;
  token: string;
  autoAccept?: boolean;
}

export function InviteAcceptForm({ teamSlug, token, autoAccept }: InviteAcceptFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAutoAccepted = useRef(false);

  const handleAccept = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to accept invite");
        setLoading(false);
        return;
      }

      router.push(`/dashboard/teams/${teamSlug}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }, [token, teamSlug, router]);

  useEffect(() => {
    if (autoAccept && !hasAutoAccepted.current) {
      hasAutoAccepted.current = true;
      handleAccept();
    }
  }, [autoAccept, handleAccept]);

  if (autoAccept && loading) {
    return (
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Joining team...
      </div>
    );
  }

  return (
    <div className="mt-6">
      {error && <p className="text-sm text-destructive mb-3">{error}</p>}
      <Button onClick={handleAccept} disabled={loading} className="w-full">
        {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
        {loading ? "Accepting..." : "Accept Invite"}
      </Button>
    </div>
  );
}
