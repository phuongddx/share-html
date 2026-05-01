// @ts-nocheck
/**
 * Enhanced Invite Acceptance Form Component
 *
 * This component handles team invite acceptance with comprehensive security validation,
 * token validation, and user-friendly error handling.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TokenSecurity, InviteValidationService } from "@dropitx/shared/auth/token-security";
import { teamRPC } from "@/lib/team-rpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, Mail, Shield } from "lucide-react";

interface InviteValidationResult {
  valid: boolean;
  data?: {
    team_id?: string;
    email?: string;
    role?: string;
    expires_at?: string;
    reason?: string;
  };
  error?: string;
  actionRequired?: string;
}

export function InviteAcceptForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [validation, setValidation] = useState<InviteValidationResult | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkTokenAndUser = async () => {
      if (!token) {
        setValidation({
          valid: false,
          error: 'No invite token provided',
          actionRequired: 'Please check the invite link'
        });
        setLoading(false);
        return;
      }

      if (!TokenSecurity.isValidTokenFormat(token)) {
        setValidation({
          valid: false,
          error: 'Invalid token format',
          actionRequired: 'The invite link is malformed'
        });
        setLoading(false);
        return;
      }

      try {
        // Get user from auth
        const { data: { user: currentUser }, error: authError } = await (await teamRPC.getRPCClient()).auth.getUser();

        if (authError || !currentUser) {
          // User not authenticated, redirect to login with token
          const loginUrl = `/auth/login?next=/invite/accept?token=${token}&message=Please sign in to accept the invite`;
          window.location.href = loginUrl;
          return;
        }

        setUser(currentUser);

        // Validate the invite token
        const validation = await InviteValidationService.validateInvite(token, currentUser.id);
        setValidation(validation);
      } catch (err) {
        setValidation({
          valid: false,
          error: 'Failed to validate invite',
          actionRequired: 'Please try again later'
        });
      } finally {
        setLoading(false);
      }
    };

    checkTokenAndUser();
  }, [token]);

  const handleAccept = async () => {
    if (!validation || !validation.valid || !user) return;

    setAccepting(true);
    setError(null);

    try {
      const result = await InviteValidationService.acceptInvite(token!, user.id);

      if (result.success) {
        // Success - redirect to team dashboard
        const teamId = result.data?.team_id;
        if (teamId) {
          router.push(`/dashboard/teams/${teamId}`);
        } else {
          // Fallback to dashboard
          router.push('/dashboard');
        }
      } else {
        setError(result.error || 'Failed to accept invite');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Validating invite...</p>
        </div>
      </div>
    );
  }

  if (!validation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Unable to validate invite. Please try again.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!validation.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Invalid Invite
            </CardTitle>
            <CardDescription>
              {validation.error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validation.actionRequired && (
              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-700">{validation.actionRequired}</p>
              </div>
            )}

            {validation.data?.reason && (
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600">
                  <strong>Details:</strong> {validation.data.reason}
                </p>
              </div>
            )}

            {validation.data?.expires_at && (
              <div className="bg-yellow-50 p-3 rounded-md">
                <p className="text-sm text-yellow-700">
                  <strong>Expiration:</strong> {new Date(validation.data.expires_at).toLocaleString()}
                </p>
              </div>
            )}

            <Button
              onClick={() => router.push('/dashboard')}
              className="w-full"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid invite - show acceptance form
  const roleColors = {
    owner: 'bg-red-100 text-red-800',
    editor: 'bg-blue-100 text-blue-800',
    viewer: 'bg-gray-100 text-gray-800'
  };

  const roleIcons = {
    owner: '👑',
    editor: '✏️',
    viewer: '👁️'
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Join Team</CardTitle>
          <CardDescription>
            You've been invited to join a team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invite Details */}
          <div className="bg-white border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Team Role:</span>
              <Badge className={roleColors[validation.data?.role as keyof typeof roleColors] || roleColors.viewer}>
                {roleIcons[validation.data?.role as keyof typeof roleIcons]} {validation.data?.role}
              </Badge>
            </div>

            {validation.data?.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Sent to: {validation.data.email}</span>
              </div>
            )}

            {validation.data?.expires_at && (
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Expires: {new Date(validation.data.expires_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Security Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Security Notice</p>
                <ul className="space-y-1 text-xs">
                  <li>• This invite is securely encrypted</li>
                  <li>• Can only be used once with the correct email</li>
                  <li>• Will expire automatically</li>
                  <li>• All activity is logged for security</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Accept Button */}
          <Button
            onClick={handleAccept}
            disabled={accepting}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            {accepting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Accept Invitation
              </>
            )}
          </Button>

          {/* User Info */}
          {user && (
            <div className="text-center text-sm text-gray-500">
              Accepting as: {user.email}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Alternative Actions */}
          <div className="text-center space-y-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}