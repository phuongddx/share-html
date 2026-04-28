"use client";

/**
 * Client component for the invite acceptance action.
 * POSTs to the accept API endpoint and redirects to the team dashboard.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface InviteAcceptFormProps {
  inviteId: string;
  teamId: string;
  teamName: string;
  teamSlug: string;
  role: string;
  token: string;
}

export function InviteAcceptForm({
  teamName,
  teamSlug,
  role,
  token,
}: InviteAcceptFormProps) {
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
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Accept Team Invite</h1>
        <p className="mt-2 text-muted-foreground">
          You have been invited to join <strong>{teamName}</strong> as{" "}
          <strong>{role}</strong>.
        </p>

        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}

        <button
          onClick={handleAccept}
          disabled={loading}
          className="mt-6 inline-block rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Accepting..." : "Accept Invite"}
        </button>
      </div>
    </div>
  );
}
