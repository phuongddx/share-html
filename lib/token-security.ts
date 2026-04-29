/**
 * Token Security Utilities for Team Invite System
 *
 * This module provides enhanced token security features including validation,
 * single-use enforcement, and security monitoring for invite tokens.
 */

import { createAdminClient } from "@/utils/supabase/server";
import crypto from "crypto";

/**
 * Token security interface
 */
export interface TokenValidationResult {
  valid: boolean;
  invite_id?: string;
  team_id?: string;
  email?: string;
  role?: string;
  expires_at?: string;
  created_at?: string;
  reason?: string;
  expired_at?: string;
  used_at?: string;
  locked_at?: string;
  locked_reason?: string;
}

export interface TokenSecurityStatus {
  isUsed: boolean;
  isExpired: boolean;
  isLocked: boolean;
  lockedReason?: string;
  expiresAt?: string;
}

/**
 * Enhanced token security utilities
 */
export class TokenSecurity {
  /**
   * Validate and lock an invite token (atomic operation)
   */
  static async validateAndLockInvite(token: string, userId: string): Promise<TokenValidationResult> {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .rpc('validate_and_lock_invite_token', {
        p_token: token,
        p_user_id: userId
      });

    if (error) {
      throw new Error(`Token validation failed: ${error.message}`);
    }

    return data as TokenValidationResult;
  }

  /**
   * Check if token has been used (double-check after validation)
   */
  static async checkTokenUsage(token: string): Promise<TokenSecurityStatus> {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from('team_invites')
      .select('id, accepted_at, expires_at, locked_at, locked_reason')
      .eq('token', token)
      .single();

    if (error) {
      throw new Error(`Failed to check token usage: ${error.message}`);
    }

    const now = new Date();
    const expiresAt = new Date(data.expires_at);

    return {
      isUsed: data.accepted_at !== null,
      isExpired: expiresAt < now,
      isLocked: data.locked_at !== null,
      lockedReason: data.locked_reason,
      expiresAt: data.expires_at
    };
  }

  /**
   * Report suspicious activity
   */
  static async reportSuspiciousActivity(teamId: string, email: string, ipAddress: string): Promise<void> {
    const supabase = await createAdminClient();

    // Log the suspicious activity
    await supabase
      .from('team_events')
      .insert({
        team_id: teamId,
        event_type: 'security_alert',
        event_data: {
          alert_type: 'user_reported_suspicious_activity',
          email,
          ip_address: ipAddress,
          reported_at: new Date().toISOString()
        },
        actor_id: (await supabase.auth.getUser()).data.user!.id,
        actor_role: 'system'
      });
  }

  /**
   * Generate secure one-time token (client-side generation)
   */
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate token format (client-side validation)
   */
  static isValidTokenFormat(token: string): boolean {
    return /^[a-f0-9]{64}$/i.test(token);
  }

  /**
   * Decode token metadata (if needed for debugging)
   * Note: This is for debugging only - actual token validation should happen server-side
   */
  static decodeToken(token: string): { timestamp?: Date; random?: string } {
    if (!this.isValidTokenFormat(token)) {
      throw new Error('Invalid token format');
    }

    // This is just for debugging - in production, decode server-side only
    return {
      timestamp: new Date(), // This would be actual timestamp in real implementation
      random: token.slice(0, 8) // First 8 chars as "random" identifier
    };
  }

  /**
   * Get token security statistics
   */
  static async getTokenSecurityStats(): Promise<any> {
    const supabase = await createAdminClient();

    const { data, error } = await supabase.rpc('get_token_security_stats');

    if (error) {
      throw new Error(`Failed to get token security stats: ${error.message}`);
    }

    return data;
  }

  /**
   * Cleanup expired tokens
   */
  static async cleanupExpiredTokens(): Promise<any> {
    const supabase = await createAdminClient();

    const { data, error } = await supabase.rpc('cleanup_expired_tokens');

    if (error) {
      throw new Error(`Failed to cleanup expired tokens: ${error.message}`);
    }

    return data;
  }

  /**
   * Reset locked tokens after timeout
   */
  static async resetLockedTokens(): Promise<any> {
    const supabase = await createAdminClient();

    const { data, error } = await supabase.rpc('reset_locked_tokens');

    if (error) {
      throw new Error(`Failed to reset locked tokens: ${error.message}`);
    }

    return data;
  }
}

/**
 * Enhanced invite validation service
 */
export class InviteValidationService {
  /**
   * Validate invite token with comprehensive checks
   */
  static async validateInvite(token: string, userId: string): Promise<{
    valid: boolean;
    data?: TokenValidationResult;
    error?: string;
    actionRequired?: string;
  }> {
    try {
      // Validate token format client-side first
      if (!TokenSecurity.isValidTokenFormat(token)) {
        return {
          valid: false,
          error: 'Invalid token format',
          actionRequired: 'Please check the invite link and try again'
        };
      }

      // Server-side validation with locking
      const validation = await TokenSecurity.validateAndLockInvite(token, userId);

      if (!validation.valid) {
        let error = 'Invalid invite';
        let actionRequired = 'Please contact the team owner for a new invite';

        switch (validation.reason) {
          case 'not_found':
            error = 'Invite not found';
            actionRequired = 'The invite may have been cancelled or does not exist';
            break;
          case 'already_used':
            error = 'This invite has already been used';
            actionRequired = 'You may already be a member of this team';
            break;
          case 'expired':
            error = 'This invite has expired';
            actionRequired = 'Please contact the team owner for a new invite';
            break;
          case 'locked':
            error = 'This invite is currently locked';
            actionRequired = 'Please try again in a few minutes';
            break;
          case 'email_mismatch':
            error = `This invite was sent to ${validation.email}. Please log in with that email address.`;
            actionRequired = 'Use the correct email address or contact the sender';
            break;
          case 'token_concurrently_used':
            error = 'This invite is being processed by another user';
            actionRequired = 'Please try again';
            break;
        }

        return {
          valid: false,
          error,
          actionRequired,
          data: validation
        };
      }

      // Additional security check: verify token hasn't been used since validation
      const usageStatus = await TokenSecurity.checkTokenUsage(token);

      if (usageStatus.isUsed) {
        return {
          valid: false,
          error: 'This invite has already been accepted',
          actionRequired: 'You may already be a member of this team',
          data: validation
        };
      }

      return {
        valid: true,
        data: validation,
        actionRequired: 'Accept the invitation to join the team'
      };

    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Failed to validate invite',
        actionRequired: 'Please try again or contact support'
      };
    }
  }

  /**
   * Accept invite with additional security checks
   */
  static async acceptInvite(token: string, userId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
    already_member?: boolean;
  }> {
    try {
      // Validate the invite first
      const validation = await this.validateInvite(token, userId);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          message: validation.actionRequired
        };
      }

      const supabase = await createAdminClient();

      // Accept the invite using RPC
      const { data, error } = await supabase
        .rpc('accept_team_invite', {
          p_token: token
        });

      if (error) {
        throw new Error(error.message);
      }

      // Log audit trail
      await this.logAcceptanceAudit(token, userId);

      return {
        success: true,
        data: data,
        message: data.already_member
          ? 'You are already a member of this team'
          : 'Successfully joined the team',
        already_member: data.already_member
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to accept invite'
      };
    }
  }

  /**
   * Log acceptance audit trail
   */
  private static async logAcceptanceAudit(token: string, userId: string): Promise<void> {
    const supabase = await createAdminClient();

    const { data: invite } = await supabase
      .from('team_invites')
      .select('team_id, email, role')
      .eq('token', token)
      .single();

    if (invite) {
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'team_members',
          operation: 'INSERT',
          record_id: null, // Will be set by the RPC
          new_data: {
            team_id: invite.team_id,
            user_id: userId,
            role: invite.role,
            joined_at: new Date().toISOString()
          },
          user_id: userId,
          ip_address: null, // Will be set by RPC
          user_agent: null // Will be set by RPC
        });
    }
  }

  /**
   * Report suspicious invite activity
   */
  static async reportSuspiciousActivity(teamId: string, email: string, ipAddress?: string): Promise<void> {
    await TokenSecurity.reportSuspiciousActivity(teamId, email, ipAddress || 'unknown');
  }
}

// Export utility functions
export const generateSecureToken = TokenSecurity.generateSecureToken;
export const isValidTokenFormat = TokenSecurity.isValidTokenFormat;
export const validateInvite = InviteValidationService.validateInvite;
export const acceptInvite = InviteValidationService.acceptInvite;
export const reportSuspiciousActivity = InviteValidationService.reportSuspiciousActivity;