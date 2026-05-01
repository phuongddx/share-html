/** Event types — must match DB CHECK constraint in team_events table exactly */
export type TeamEventType =
  | "invite.created"
  | "invite.accepted"
  | "invite.declined"
  | "invite.revoked"
  | "invite.expired"
  | "member.joined"
  | "member.left"
  | "member.role_changed"
  | "member.removed";

/** A single team event row from team_events table */
export interface TeamEvent {
  id: string;
  team_id: string;
  actor_id: string | null;
  target_user_id: string | null;
  event_type: TeamEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Invite status — must match DB CHECK constraint on team_invites.status */
export type TeamInviteStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked"
  | "expired";

/** Paginated events response from GET /api/.../events */
export interface TeamEventsResponse {
  events: TeamEvent[];
  total: number;
  limit: number;
  offset: number;
}
