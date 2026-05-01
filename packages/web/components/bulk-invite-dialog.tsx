// @ts-nocheck
"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  Users,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy
} from "lucide-react";
import { toast } from "sonner";
import type { TeamRole } from "@dropitx/shared/types/team";

interface BulkInviteDialogProps {
  teamSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvitesCreated: () => void;
}

interface BulkInviteResult {
  success: string[];
  failed: Array<{ email: string; error: string }>;
  duplicates: string[];
}

export function BulkInviteDialog({
  teamSlug,
  open,
  onOpenChange,
  onInvitesCreated,
}: BulkInviteDialogProps) {
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<TeamRole>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BulkInviteResult | null>(null);

  const handleBulkInvite = async () => {
    setSubmitting(true);
    setResults(null);

    // Parse emails from comma or newline separated input
    const emailList = emails
      .split(/[,\n]/)
      .map(email => email.trim())
      .filter(email => email.length > 0);

    try {
      const res = await fetch(`/api/dashboard/teams/${teamSlug}/invites/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: emailList, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send bulk invites");
      }

      setResults({
        success: data.invites.map((invite: any) => invite.email),
        failed: data.errors || [],
        duplicates: data.duplicates || []
      });

      if (data.created_count > 0) {
        toast.success(`Successfully created ${data.created_count} invitation${data.created_count !== 1 ? 's' : ''}`);
      }

      if (data.duplicate_count > 0) {
        toast.warning(`${data.duplicate_count} duplicate invite${data.duplicate_count !== 1 ? 's' : ''} skipped`);
      }

      if (data.error_count > 0) {
        toast.error(`${data.error_count} invitation${data.error_count !== 1 ? 's' : ''} failed`);
      }

      // Reset form if successful
      if (data.created_count > 0) {
        setEmails("");
        onInvitesCreated();
      }

    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send bulk invites");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearResults = () => {
    setResults(null);
  };

  const handleCopySuccess = () => {
    if (results && results.success.length > 0) {
      const text = results.success.join('\n');
      navigator.clipboard.writeText(text).then(() => {
        toast.success("Successfully copied email list");
      });
    }
  };

  const handleCopyFailed = () => {
    if (results && results.failed.length > 0) {
      const text = results.failed.map(item => `${item.email}: ${item.error}`).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        toast.success("Successfully copied failed emails");
      });
    }
  };

  const getEmailCount = () => {
    if (!emails.trim()) return 0;
    const emailList = emails
      .split(/[,\n]/)
      .map(email => email.trim())
      .filter(email => email.length > 0);
    return emailList.length;
  };

  const getPreviewEmails = () => {
    if (!emails.trim()) return [];
    const emailList = emails
      .split(/[,\n]/)
      .map(email => email.trim())
      .filter(email => email.length > 0)
      .slice(0, 5); // Show first 5 as preview
    return emailList;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="size-4 mr-2" />
          Bulk Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Invite Members</DialogTitle>
          <DialogDescription>
            Enter multiple email addresses separated by commas or new lines.
            Each person will receive an invitation with the selected role.
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4">
            {/* Email Input */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Email Addresses
              </label>
              <Textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="colleague1@example.com, colleague2@example.com, ..."
                className="w-full min-h-[120px] resize-y"
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-muted-foreground">
                  {getEmailCount() > 0
                    ? `${getEmailCount()} email address${getEmailCount() !== 1 ? 'es' : ''} ready to invite`
                    : 'Enter email addresses separated by commas or new lines'
                  }
                </p>
                <Badge variant="outline">
                  Max 50 per request
                </Badge>
              </div>

              {/* Preview */}
              {getPreviewEmails().length > 0 && (
                <div className="mt-2 p-2 bg-muted rounded text-xs">
                  <p className="font-medium mb-1">Preview:</p>
                  <div className="space-y-1">
                    {getPreviewEmails().map((email, index) => (
                      <div key={index} className="text-muted-foreground">
                        • {email}
                        {index === 4 && emails.split(/[,\n]/).filter(e => e.trim()).length > 5 && (
                          <span className="ml-2">+{emails.split(/[,\n]/).filter(e => e.trim()).length - 5} more</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Role Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Default Role
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
              <Button variant="outline" onClick={() => setEmails('')}>
                Clear
              </Button>
              <Button
                onClick={handleBulkInvite}
                disabled={submitting || getEmailCount() === 0}
                className="min-w-[120px]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="size-4 mr-2" />
                    Send ({getEmailCount()})
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-3">Invite Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">{results.success.length}</div>
                  <div className="text-xs text-muted-foreground">Success</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{results.duplicates.length}</div>
                  <div className="text-xs text-muted-foreground">Duplicates</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{results.failed.length}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>
            </div>

            {/* Success Section */}
            {results.success.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-green-700 flex items-center gap-2">
                    <CheckCircle className="size-4" />
                    Successfully Invited ({results.success.length})
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopySuccess}
                    className="text-xs"
                  >
                    <Copy className="size-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {results.success.map(email => (
                    <div key={email} className="text-sm text-green-700 bg-green-50 p-2 rounded">
                      ✓ {email}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duplicates Section */}
            {results.duplicates.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-yellow-700 flex items-center gap-2">
                  <AlertCircle className="size-4" />
                  Already Invited ({results.duplicates.length})
                </h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {results.duplicates.map(email => (
                    <div key={email} className="text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                      ⚠ {email}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed Section */}
            {results.failed.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-red-700 flex items-center gap-2">
                    <XCircle className="size-4" />
                    Failed to Invite ({results.failed.length})
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyFailed}
                    className="text-xs"
                  >
                    <Copy className="size-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {results.failed.map(({ email, error }, index) => (
                    <div key={index} className="text-sm text-red-700 bg-red-50 p-2 rounded">
                      ✗ {email}: {error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClearResults}>
                Create More Invites
              </Button>
              <Button onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}