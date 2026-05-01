// @ts-nocheck
/**
 * Team RPC Utilities for Next.js Integration
 *
 * This module provides secure integration with Supabase RPC functions
 * for team management operations. All functions use SECURITY DEFINER
 * functions for atomic operations and proper authorization.
 */

import { createAdminClient } from "@dropitx/shared/supabase/admin";
import type { TeamRole } from "@dropitx/shared/types/team";

export interface CreateTeamParams {
  name: string;
  plan?: 'free' | 'pro';
}

export interface CreateInviteParams {
  teamId: string;
  email: string;
  role?: TeamRole;
  maxPerHour?: number;
  maxPerDay?: number;
  maxPerWeek?: number;
}

export interface AcceptInviteParams {
  token: string;
}

export interface TransferOwnershipParams {
  teamId: string;
  newOwnerId: string;
}

export interface UpdateMemberRoleParams {
  teamId: string;
  userId: string;
  role: TeamRole;
}

export interface RemoveMemberParams {
  teamId: string;
  userId: string;
}

export interface BulkInviteParams {
  teamId: string;
  emails: string[];
  role: TeamRole;
}

export interface RateLimitInfo {
  is_limited: boolean;
  limit_type?: string;
  hourly: {
    count: number;
    limit: number;
    remaining: number;
  };
  daily: {
    count: number;
    limit: number;
    remaining: number;
  };
  weekly: {
    count: number;
    limit: number;
    remaining: number;
  };
  next_available?: string;
}

export interface InviteResult {
  invite_id?: string;
  token?: string;
  expires_at?: string;
  rate_limited?: boolean;
  rate_limit_info?: RateLimitInfo;
}

export interface AcceptInviteResult {
  team_id?: string;
  role?: string;
  already_member?: boolean;
}

/**
 * Team RPC Client - Handles all team-related RPC operations
 */
export class TeamRPC {
  async getRPCClient() {
    return await createAdminClient();
  }

  /**
   * Create a new team with proper validation
   */
  async createTeam(params: CreateTeamParams) {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('create_team', {
      p_name: params.name,
      p_plan: params.plan || 'free'
    });

    if (error) {
      throw new Error(`Failed to create team: ${error.message}`);
    }

    return data;
  }

  /**
   * Create team invite with rate limiting
   */
  async createInvite(params: CreateInviteParams): Promise<InviteResult> {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('create_team_invite_with_rate_check', {
      p_team_id: params.teamId,
      p_email: params.email,
      p_role: params.role || 'viewer',
      p_max_per_hour: params.maxPerHour || 10,
      p_max_per_day: params.maxPerDay || 50,
      p_max_per_week: params.maxPerWeek || 200
    });

    if (error) {
      throw new Error(`Failed to create invite: ${error.message}`);
    }

    return data as InviteResult;
  }

  /**
   * Accept team invite with validation
   */
  async acceptInvite(params: AcceptInviteParams): Promise<AcceptInviteResult> {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('accept_team_invite', {
      p_token: params.token
    });

    if (error) {
      throw new Error(`Failed to accept invite: ${error.message}`);
    }

    return data as AcceptInviteResult;
  }

  /**
   * Transfer team ownership
   */
  async transferOwnership(params: TransferOwnershipParams) {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('transfer_team_ownership', {
      p_team_id: params.teamId,
      p_new_owner_id: params.newOwnerId
    });

    if (error) {
      throw new Error(`Failed to transfer ownership: ${error.message}`);
    }

    return data;
  }

  /**
   * Update member role
   */
  async updateMemberRole(params: UpdateMemberRoleParams) {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('update_member_role', {
      p_team_id: params.teamId,
      p_user_id: params.userId,
      p_new_role: params.role
    });

    if (error) {
      throw new Error(`Failed to update member role: ${error.message}`);
    }

    return data;
  }

  /**
   * Remove team member
   */
  async removeMember(params: RemoveMemberParams) {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('remove_team_member', {
      p_team_id: params.teamId,
      p_user_id: params.userId
    });

    if (error) {
      throw new Error(`Failed to remove member: ${error.message}`);
    }

    return data;
  }

  /**
   * Add team member directly
   */
  async addMember(teamId: string, userId: string, role: TeamRole = 'viewer') {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('add_team_member', {
      p_team_id: teamId,
      p_user_id: userId,
      p_role: role
    });

    if (error) {
      throw new Error(`Failed to add member: ${error.message}`);
    }

    return data;
  }

  /**
   * Bulk invite operation
   */
  async bulkInvite(params: BulkInviteParams) {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('bulk_invite_transaction', {
      p_team_id: params.teamId,
      p_emails: params.emails,
      p_role: params.role
    });

    if (error) {
      throw new Error(`Failed to bulk invite: ${error.message}`);
    }

    return data;
  }

  /**
   * Revoke team invite
   */
  async revokeInvite(inviteId: string) {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('revoke_team_invite', {
      p_invite_id: inviteId
    });

    if (error) {
      throw new Error(`Failed to revoke invite: ${error.message}`);
    }

    return data;
  }

  /**
   * Check rate limit before creating invite
   */
  async checkRateLimit(teamId: string, email: string): Promise<RateLimitInfo> {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('check_invite_rate_limit', {
      p_team_id: teamId,
      p_email: email,
      p_max_per_hour: 10,
      p_max_per_day: 50,
      p_max_per_week: 200
    });

    if (error) {
      throw new Error(`Failed to check rate limit: ${error.message}`);
    }

    return data as RateLimitInfo;
  }

  /**
   * Check global rate limit
   */
  async checkGlobalRateLimit(): Promise<any> {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('check_global_invite_rate_limit', {
      p_max_teams_per_hour: 5,
      p_max_invites_per_hour: 20,
      p_max_total_invites_per_day: 100
    });

    if (error) {
      throw new Error(`Failed to check global rate limit: ${error.message}`);
    }

    return data;
  }

  /**
   * Get rate limiting statistics
   */
  async getRateLimitingStats(): Promise<any> {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('get_rate_limiting_stats');

    if (error) {
      throw new Error(`Failed to get rate limiting stats: ${error.message}`);
    }

    return data;
  }

  /**
   * Cleanup old rate limiting data
   */
  async cleanupRateLimitingData(): Promise<any> {
    const supabase = await this.getRPCClient();

    const { data, error } = await supabase.rpc('cleanup_rate_limiting_data');

    if (error) {
      throw new Error(`Failed to cleanup rate limiting data: ${error.message}`);
    }

    return data;
  }
}

/**
 * Team Service - Higher-level business logic for team operations
 */
export class TeamService {
  private rpc: TeamRPC;

  constructor() {
    this.rpc = new TeamRPC();
  }

  /**
   * Create a team with validation and error handling
   */
  async createTeamWithValidation(params: CreateTeamParams & { userId: string }) {
    // Validate team name
    if (!params.name || params.name.trim().length < 2) {
      throw new Error('Team name must be at least 2 characters long');
    }

    if (params.name.length > 100) {
      throw new Error('Team name must be less than 100 characters');
    }

    // Validate plan
    if (params.plan && params.plan !== 'free' && params.plan !== 'pro') {
      throw new Error('Plan must be either "free" or "pro"');
    }

    try {
      const teamId = await this.rpc.createTeam(params);
      return { success: true, team_id: teamId };
    } catch (error) {
      if (error.message.includes('Maximum number of teams')) {
        throw new Error('You have reached the maximum number of teams (10)');
      }
      throw error;
    }
  }

  /**
   * Create invite with comprehensive validation
   */
  async createInviteWithValidation(params: CreateInviteParams & { userId: string }) {
    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(params.email)) {
      throw new Error('Invalid email format');
    }

    // Check rate limit before attempting to create invite
    const rateLimitInfo = await this.rpc.checkRateLimit(params.teamId, params.email);

    if (rateLimitInfo.is_limited) {
      const nextAvailable = new Date(rateLimitInfo.next_available!).toLocaleString();
      throw new Error(`Rate limit exceeded. Try again after ${nextAvailable}`);
    }

    // Validate role
    if (!['viewer', 'editor', 'owner'].includes(params.role || 'viewer')) {
      throw new Error('Invalid role. Must be viewer, editor, or owner');
    }

    try {
      const result = await this.rpc.createInvite(params);

      // If rate limited, return the rate limit info
      if (result.rate_limited) {
        return {
          success: false,
          rate_limited: true,
          rate_limit_info: result.rate_limit_info,
          message: 'Rate limit exceeded. Please try again later.'
        };
      }

      return { success: true, invite: result };
    } catch (error) {
      if (error.message.includes('Rate limit exceeded')) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (error.message.includes('Pending invite already exists')) {
        throw new Error('A pending invite already exists for this email');
      }
      if (error.message.includes('Free teams are limited')) {
        throw new Error('Free teams are limited to 3 members. Upgrade to Pro to invite more.');
      }
      throw error;
    }
  }

  /**
   * Accept invite with validation
   */
  async acceptInviteWithValidation(params: AcceptInviteParams & { userId: string }) {
    // Validate token format
    if (!params.token || params.token.length !== 64) {
      throw new Error('Invalid invite token format');
    }

    try {
      const result = await this.rpc.acceptInvite(params);

      return {
        success: true,
        data: result,
        message: result.already_member
          ? 'You are already a member of this team'
          : 'Successfully joined the team'
      };
    } catch (error) {
      if (error.message.includes('email mismatch')) {
        throw new Error('This invite was sent to a different email address. Please log in with the correct email.');
      }
      if (error.message.includes('already used')) {
        throw new Error('This invite has already been used');
      }
      if (error.message.includes('expired')) {
        throw new Error('This invite has expired');
      }
      throw error;
    }
  }

  /**
   * Transfer ownership with validation
   */
  async transferOwnershipWithValidation(params: TransferOwnershipParams & { userId: string }) {
    try {
      const result = await this.rpc.transferOwnership(params);
      return { success: true, data: result };
    } catch (error) {
      if (error.message.includes('Only team owners can transfer ownership')) {
        throw new Error('Only team owners can transfer ownership');
      }
      if (error.message.includes('New owner must be a team member first')) {
        throw new Error('The new owner must be a team member first');
      }
      if (error.message.includes('last owner')) {
        throw new Error('Cannot transfer ownership: you are the last owner of the team');
      }
      throw error;
    }
  }

  /**
   * Update member role with validation
   */
  async updateMemberRoleWithValidation(params: UpdateMemberRoleParams & { userId: string }) {
    try {
      const result = await this.rpc.updateMemberRole(params);
      return { success: true, data: result };
    } catch (error) {
      if (error.message.includes('Only team owners can change member roles')) {
        throw new Error('Only team owners can change member roles');
      }
      if (error.message.includes('Cannot demote yourself')) {
        throw new Error('Cannot demote yourself: you are the last owner of the team');
      }
      throw error;
    }
  }

  /**
   * Remove member with validation
   */
  async removeMemberWithValidation(params: RemoveMemberParams & { userId: string }) {
    try {
      const result = await this.rpc.removeMember(params);
      return { success: true, data: result };
    } catch (error) {
      if (error.message.includes('Only team owners can remove other members')) {
        throw new Error('Only team owners can remove other members');
      }
      if (error.message.includes('last owner')) {
        throw new Error('Cannot remove the last owner of the team');
      }
      throw error;
    }
  }

  /**
   * Bulk invite with validation
   */
  async bulkInviteWithValidation(params: BulkInviteParams & { userId: string }) {
    // Validate emails
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    const invalidEmails = params.emails.filter(email => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      throw new Error(`Invalid email formats: ${invalidEmails.join(', ')}`);
    }

    // Check total count
    if (params.emails.length > 50) {
      throw new Error('Cannot invite more than 50 users at once');
    }

    try {
      const result = await this.rpc.bulkInvite(params);
      return { success: true, data: result };
    } catch (error) {
      if (error.message.includes('Only editors and owners can create invites')) {
        throw new Error('Only editors and owners can create invites');
      }
      throw error;
    }
  }
}

// Export singleton instances
export const teamRPC = new TeamRPC();
export const teamService = new TeamService();