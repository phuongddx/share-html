"use client";

/**
 * Invite member dialog — creates invites via API, shows pending invites.
 * Uses router.refresh() for data invalidation after invite creation/cancellation.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, Copy, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import { isValidEmail } from "@dropitx/shared/validation/email";
import type { TeamRole, TeamInvite } from "@dropitx/shared/types/team";

interface InviteMemberDialogProps {
  teamSlug: string;
  open: boolean;
  onClose: () => void;
  /** Existing pending invites to display. */
  pendingInvites: TeamInvite[];
}

/** Formats ISO date to short display. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function InviteMemberDialog({
  teamSlug,
  open,
  onClose,
  pendingInvites,
}: InviteMemberDialogProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setRateLimited(false);
      setInviteUrl(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !isValidEmail(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSubmitting(true);
    setInviteUrl(null);
    try {
      const res = await fetch(`/api/dashboard/teams/${teamSlug}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invite");

      if (data.rate_limited) {
        setRateLimited(true);
        toast.error("Rate limit reached. Try again later.");
        return;
      }

      setInviteUrl(data.invite_url);
      toast.success("Invite created");
      setEmail("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create invite",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelInvite(inviteId: string) {
    setCancellingId(inviteId);
    try {
      const res = await fetch(
        `/api/dashboard/teams/${teamSlug}/invites?id=${inviteId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to cancel invite");
      toast.success("Invite cancelled");
      router.refresh();
    } catch {
      toast.error("Failed to cancel invite");
    } finally {
      setCancellingId(null);
    }
  }

  function handleCopyUrl(url: string) {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Invite link copied"),
      () => toast.error("Failed to copy link"),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Invite Member</h3>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Invite form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="text-sm font-medium">
              Email Address
            </label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              maxLength={255}
              className="h-10 rounded-md"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="invite-role" className="text-sm font-medium">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value as TeamRole)}
              className="h-10 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="viewer">Viewer — Can view shares</option>
              <option value="editor">Editor — Can create and edit shares</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Create Invite
            </Button>
          </div>
        </form>

        {/* Rate limit warning */}
        {rateLimited && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              Rate limit reached
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Too many invites sent recently. Please wait before creating more.
            </p>
          </div>
        )}

        {/* Generated invite link */}
        {inviteUrl && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Invite Link</p>
            <p className="text-xs text-muted-foreground">
              Copy and send this link to the person you want to invite.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                {inviteUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopyUrl(inviteUrl)}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Pending Invites</p>
            <div className="divide-y">
              {pendingInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{inv.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {inv.role}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        Expires {formatDate(inv.expires_at)}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleCancelInvite(inv.id)}
                    disabled={cancellingId === inv.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {cancellingId === inv.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <X className="size-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
