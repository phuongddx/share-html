// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  X,
  Mail,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Clock,
  UserPlus,
  MessageCircle
} from "lucide-react";
import { toast } from "sonner";
import type { TeamRole, TeamInvite } from "@dropitx/shared/types/team";
import { useEmailValidation } from "@/hooks/use-email-validation";
import { CopyButton } from "@/components/copy-button";

interface EnhancedInviteDialogProps {
  teamSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInviteCreated: () => void;
  pendingInvites: TeamInvite[];
}

export function EnhancedInviteDialog({
  teamSlug,
  open,
  onOpenChange,
  onInviteCreated,
  pendingInvites,
}: EnhancedInviteDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const { email: validatedEmail, errors, isValid, hasErrors } = useEmailValidation(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid || hasErrors) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSubmitting(true);
    setInviteUrl(null);

    try {
      const res = await fetch(`/api/dashboard/teams/${teamSlug}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: validatedEmail, role }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invite");

      setInviteUrl(data.invite_url);
      toast.success("Invite created successfully");
      setEmail("");
      onInviteCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    setCancellingId(inviteId);
    try {
      const res = await fetch(
        `/api/dashboard/teams/${teamSlug}/invites?id=${inviteId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to cancel invite");
      toast.success("Invite cancelled");
      onInviteCreated();
    } catch (error) {
      toast.error("Failed to cancel invite");
    } finally {
      setCancellingId(null);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    setResendingId(inviteId);
    try {
      const res = await fetch(`/api/dashboard/teams/${teamSlug}/invites/${inviteId}/resend`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to resend invite");
      toast.success("Invite resent successfully");
      onInviteCreated();
    } catch (error) {
      toast.error("Failed to resend invite");
    } finally {
      setResendingId(null);
    }
  };

  const handleShareViaEmail = (url: string) => {
    const subject = `Invitation to join team on DropItX`;
    const body = `I'd like to invite you to join our team on DropItX. Click the link below to accept:\n\n${url}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleShareViaSlack = (url: string) => {
    const text = `Join our team on DropItX: ${url}`;
    const encoded = encodeURIComponent(`:mailbox_with_mail: ${text}`);
    window.open(`https://slack.com/share?text=${encoded}`);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const getStatus = (invite: TeamInvite) => {
    if (invite.accepted_at) return "accepted";
    if (new Date(invite.expires_at) < new Date()) return "expired";
    return "pending";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4 mr-2" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Enter an email address and select a role to send an invitation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input with Validation */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email Address
            </label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                className={`${hasErrors ? 'border-destructive' : ''}`}
                maxLength={255}
              />
              {email && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setEmail('')}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>

            {hasErrors && (
              <div className="space-y-1">
                {errors.map((error, index) => (
                  <p key={index} className="text-sm text-destructive">
                    {error}
                  </p>
                ))}
              </div>
            )}

            {email && !hasErrors && (
              <p className="text-sm text-green-600">✓ Valid email address</p>
            )}
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-medium">
              Role
            </label>
            <Select value={role} onValueChange={(value: TeamRole) => setRole(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Viewer — Can view shares
                  </div>
                </SelectItem>
                <SelectItem value="editor">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    Editor — Can create and edit shares
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting || !isValid || hasErrors}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="size-4 mr-2" />
                  Send Invite
                </>
              )}
            </Button>
          </DialogFooter>
        </form>

        {/* Generated Invite Link */}
        {inviteUrl && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Invite Link</h4>
              <Badge variant="secondary">Generated</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Copy and send this link to the person you want to invite.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                {inviteUrl}
              </code>
              <CopyButton text={inviteUrl} />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShareViaEmail(inviteUrl)}
              >
                <Mail className="size-4 mr-2" />
                Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShareViaSlack(inviteUrl)}
              >
                <MessageCircle className="size-4 mr-2" />
                Slack
              </Button>
            </div>
          </div>
        )}

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-medium">Pending Invites</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {pendingInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{inv.email}</span>
                      <StatusBadge status={getStatus(inv)} expiresAt={inv.expires_at} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Clock className="size-3 inline mr-1" />
                      Expires {formatDate(inv.expires_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    {getStatus(inv) === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleResendInvite(inv.id)}
                        disabled={resendingId === inv.id}
                        title="Resend invite"
                      >
                        {resendingId === inv.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3" />
                        )}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleCancelInvite(inv.id)}
                      disabled={cancellingId === inv.id}
                      title={getStatus(inv) === 'pending' ? "Cancel invite" : "Remove"}
                    >
                      {cancellingId === inv.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <X className="size-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status, expiresAt }: {
  status: string;
  expiresAt?: string
}) {
  const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    pending: "default",
    accepted: "secondary",
    expired: "destructive",
    revoked: "destructive",
    failed: "destructive"
  };

  const labels: Record<string, string> = {
    pending: "Pending",
    accepted: "Accepted",
    expired: "Expired",
    revoked: "Revoked",
    failed: "Failed"
  };

  const isExpired = status === 'pending' && expiresAt && new Date(expiresAt) < new Date();

  return (
    <Badge variant={isExpired ? "destructive" : variants[status]}>
      {isExpired ? "Expired" : labels[status]}
    </Badge>
  );
}