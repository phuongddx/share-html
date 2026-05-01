import type { TeamInviteStatus } from "./team-event";

export type TeamRole = "owner" | "editor" | "viewer";
export type TeamPlan = "free" | "pro";

export interface Team {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  plan: TeamPlan;
  created_at: string;
  /** Populated via join — only when querying with member context */
  member_count?: number;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: TeamRole;
  invited_at: string;
  joined_at: string;
  /** Populated via join with user_profiles */
  display_name?: string;
  avatar_url?: string;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole;
  token: string;
  expires_at: string;
  /** Invite lifecycle status */
  status: TeamInviteStatus;
  accepted_at: string | null;
  invited_by: string;
  created_at: string;
  /** Populated via join with user_profiles */
  inviter_name?: string;
}

export interface TeamShare {
  share_id: string;
  team_id: string;
  shared_by: string;
  created_at: string;
}

/** For the "create team" form payload */
export interface CreateTeamInput {
  name: string;
  slug: string;
}

/** For the "invite member" form payload */
export interface CreateInviteInput {
  email: string;
  role: TeamRole;
}
