/**
 * Enhanced Team Invite Form Component
 *
 * This component handles team invite creation with comprehensive rate limiting,
 * security validation, and user feedback. Uses RPC functions for secure operations.
 */

// @ts-nocheck
"use client";

import { useState } from "react";
import { useTeam } from "@/hooks/use-team";
import { teamService, teamRPC } from "@/lib/team-rpc";
import { TokenSecurity, generateSecureToken } from "@dropitx/shared/auth/token-security";
import type { TeamRole } from "@dropitx/shared/types/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail,
  Users,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  Copy,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InviteResult {
  invite_id?: string;
  token?: string;
  expires_at?: string;
  rate_limited?: boolean;
  rate_limit_info?: {
    is_limited: boolean;
    limit_type?: string;
    hourly: { count: number; limit: number; remaining: number };
    daily: { count: number; limit: number; remaining: number };
  };
}

interface RateLimitInfo {
  is_limited: boolean;
  limit_type?: string;
  hourly: { count: number; limit: number; remaining: number };
  daily: { count: number; limit: number; remaining: number };
  next_available?: string;
}

export function TeamInviteForm() {
  const { team } = useTeam();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [checkingRateLimit, setCheckingRateLimit] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const { toast } = useToast();

  if (!team) {
    return <div>Please select a team first</div>;
  }

  const handleCreateInvite = async (emailList: string[]) => {
    const emails = emailList.map(email => email.trim()).filter(Boolean);

    if (emails.length === 0) {
      setError("Please enter at least one email address");
      return;
    }

    if (emails.length > 50) {
      setError("Cannot invite more than 50 users at once");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await teamService.createInviteWithValidation({
        teamId: team.id,
        email: emails[0], // Handle single email for now
        role,
        userId: team.user?.id || ""
      });

      if (!result.success) {
        if (result.rate_limited) {
          setError(`Rate limited: ${result.message}`);
          setRateLimitInfo(result.rate_limit_info!);
        } else {
          setError(result.message ?? "Unknown error");
        }
        return;
      }

      setInviteResult(result.invite!);
      setShowSuccess(true);
      setEmail("");

      // Clear the form
      setTimeout(() => {
        setShowSuccess(false);
        setInviteResult(null);
      }, 5000);

      toast({
        title: "Invite created successfully!",
        description: `Invite sent to ${emails[0]}`,
        variant: "default"
      });

    } catch (err: any) {
      setError(err.message || "Failed to create invite");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckRateLimit = async () => {
    if (!email) return;

    setCheckingRateLimit(true);
    try {
      const info = await teamRPC.checkRateLimit(team.id, email);
      setRateLimitInfo(info);

      if (info.is_limited) {
        toast({
          title: "Rate limit reached",
          description: `Try again after ${new Date(info.next_available!).toLocaleString()}`,
          variant: "destructive"
        });
      }
    } catch (err: any) {
      setError(`Failed to check rate limit: ${err.message}`);
    } finally {
      setCheckingRateLimit(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteResult?.token) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com";
    const inviteUrl = `${appUrl}/invite/accept?token=${inviteResult.token}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);

      toast({
        title: "Invite link copied!",
        description: "Link copied to clipboard"
      });
    } catch (err) {
      setError("Failed to copy invite link");
    }
  };

  const handleBulkInvite = async () => {
    const emails = bulkEmails.split('\n').map(email => email.trim()).filter(email =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );

    if (emails.length === 0) {
      setError("Please enter valid email addresses");
      return;
    }

    setBulkLoading(true);
    setError(null);

    try {
      const result = await teamService.bulkInviteWithValidation({
        teamId: team.id,
        emails,
        role,
        userId: team.user?.id || ""
      });

      if (!result.success) {
        setError(result.message || "Failed to create bulk invites");
        return;
      }

      const successCount = result.data?.success_count || 0;
      const errorCount = result.data?.error_count || 0;

      toast({
        title: "Bulk invite completed",
        description: `${successCount} invites created, ${errorCount} errors`
      });

      setBulkEmails("");
      setBulkMode(false);

    } catch (err: any) {
      setError(err.message || "Failed to create bulk invites");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSingleInvite = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    await handleCreateInvite([email]);
  };

  const getRoleColor = (role: TeamRole) => {
    switch (role) {
      case 'owner': return 'bg-red-100 text-red-800 border-red-200';
      case 'editor': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'viewer': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleDescription = (role: TeamRole) => {
    switch (role) {
      case 'owner': return 'Full access, can manage team and members';
      case 'editor': return 'Can create, edit, and share content';
      case 'viewer': return 'Can view content only';
      default: return '';
    }
  };

  if (showSuccess && inviteResult) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dropitx.com";
    const inviteUrl = `${appUrl}/invite/accept?token=${inviteResult.token}`;

    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-green-800">Invite Created Successfully!</h3>
              <p className="text-green-600">Invite sent to {email}</p>
            </div>

            <div className="bg-white border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Invite Link:</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyInviteLink}
                    className="text-xs"
                  >
                    {isCopied ? (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    {isCopied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>

              <div className="bg-gray-50 p-2 rounded text-xs font-mono break-all">
                {inviteUrl}
              </div>

              <div className="text-xs text-gray-500">
                Expires: {new Date(inviteResult.expires_at!).toLocaleString()}
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setShowSuccess(false);
                setInviteResult(null);
              }}
              className="mt-4"
            >
              Create Another Invite
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bulk Invite Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Invite Team Members</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBulkMode(!bulkMode)}
        >
          {bulkMode ? 'Single Invite' : 'Bulk Invite'}
        </Button>
      </div>

      {bulkMode ? (
        <BulkInviteForm
          emails={bulkEmails}
          setEmails={setBulkEmails}
          loading={bulkLoading}
          onInvite={handleBulkInvite}
          error={error}
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-5 w-5" />
              <CardTitle className="text-lg">Create Invite</CardTitle>
            </div>
            <CardDescription>
              Send an invitation to someone to join your team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                <Button
                  variant="outline"
                  onClick={handleCheckRateLimit}
                  disabled={!email || checkingRateLimit || loading}
                  size="sm"
                >
                  {checkingRateLimit ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium">
                Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['owner', 'editor', 'viewer'] as TeamRole[]).map((availableRole) => (
                  <Button
                    key={availableRole}
                    variant={role === availableRole ? "default" : "outline"}
                    onClick={() => setRole(availableRole)}
                    disabled={
                      (availableRole === 'owner' && team.role !== 'owner') ||
                      loading
                    }
                    className="text-xs"
                  >
                    <Badge className={getRoleColor(availableRole)}>
                      {availableRole}
                    </Badge>
                  </Button>
                ))}
              </div>
              {team.role !== 'owner' && role === 'owner' && (
                <p className="text-xs text-yellow-600">
                  Only team owners can invite other owners
                </p>
              )}
            </div>

            {role && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>{role}:</strong> {getRoleDescription(role)}
                </p>
              </div>
            )}

            {/* Security Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Security Features</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Rate limiting to prevent abuse</li>
                    <li>• Email matching validation</li>
                    <li>• Single-use tokens</li>
                    <li>• Activity monitoring and alerts</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Rate Limit Status */}
            {rateLimitInfo && (
              <RateLimitDisplay info={rateLimitInfo} />
            )}

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Create Invite Button */}
            <Button
              onClick={handleSingleInvite}
              disabled={loading || !email}
              className="w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating Invite...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Create Invite
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface BulkInviteFormProps {
  emails: string;
  setEmails: (emails: string) => void;
  loading: boolean;
  onInvite: () => void;
  error: string | null;
}

function BulkInviteForm({ emails, setEmails, loading, onInvite, error }: BulkInviteFormProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5" />
          <CardTitle className="text-lg">Bulk Invite</CardTitle>
        </div>
        <CardDescription>
          Enter one email address per line (maximum 50)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="john@example.com&#10;jane@example.com&#10;team@company.com"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          disabled={loading}
          rows={6}
          className="font-mono text-sm"
        />

        <div className="text-xs text-gray-500">
          {emails.split('\n').filter(Boolean).length} email addresses entered
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          onClick={onInvite}
          disabled={loading || !emails}
          className="w-full"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Creating Invites...
            </>
          ) : (
            <>
              <Users className="h-4 w-4 mr-2" />
              Create Bulk Invites
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

interface RateLimitDisplayProps {
  info: RateLimitInfo;
}

function RateLimitDisplay({ info }: RateLimitDisplayProps) {
  if (!info.is_limited) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Rate limit OK</span>
        </div>
        <div className="mt-2 text-xs text-green-700">
          Hourly: {info.hourly.remaining}/{info.hourly.limit} remaining
        </div>
      </div>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-1">
          <p className="font-medium">Rate limit exceeded</p>
          <p className="text-xs">
            Limit type: {info.limit_type} - Next available: {new Date(info.next_available!).toLocaleString()}
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}