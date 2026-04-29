"use client";

/**
 * Client component for the invite acceptance action.
 * POSTs to the accept API endpoint and redirects to the team dashboard.
 * Only needs teamSlug (for redirect) and token (for the API call).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface InviteAcceptFormProps {
  teamSlug: string;
  token: string;
}

export function InviteAcceptForm({ teamSlug, token }: InviteAcceptFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
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
