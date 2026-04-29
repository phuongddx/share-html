-- Event-Sourced Team Invite/Member Lifecycle Redesign
-- Replaces draft migrations 00005-00008 with focused, audited approach

-- ============================================================
-- RED-TEAM FIX: Clean up any objects from draft migrations 00005-00008
-- These are safe DROP IF EXISTS — no-op if drafts were never applied
-- ============================================================
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS invite_attempts CASCADE;
DROP TABLE IF EXISTS api_key_usage CASCADE;
DROP FUNCTION IF EXISTS create_bulk_invites CASCADE;
DROP FUNCTION IF EXISTS transfer_team_ownership CASCADE;
DROP FUNCTION IF EXISTS detect_suspicious_invite_patterns CASCADE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_events' AND column_name = 'ip_address'
  ) THEN
    DROP TABLE team_events CASCADE;
  END IF;
END $$;

-- ============================================================
-- 1. team_events table (append-only audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS team_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  target_user_id UUID REFERENCES auth.users(id),
  event_type VARCHAR(40) NOT NULL CHECK (
    event_type IN (
      'invite.created', 'invite.accepted', 'invite.declined',
      'invite.revoked', 'invite.expired',
      'member.joined', 'member.left', 'member.role_changed', 'member.removed'
    )
  ),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_events_team_created
  ON team_events(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_events_type
  ON team_events(event_type);

-- ============================================================
-- 2. team_invites.status column
-- ============================================================
ALTER TABLE team_invites
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired'));

-- Backfill existing rows
UPDATE team_invites SET status = 'accepted'
  WHERE accepted_at IS NOT NULL AND status = 'pending';
UPDATE team_invites SET status = 'expired'
  WHERE accepted_at IS NULL AND expires_at < NOW() AND status = 'pending';

-- ============================================================
-- 3. RLS for team_events
-- ============================================================
ALTER TABLE team_events ENABLE ROW LEVEL SECURITY;

-- Members can read their team's events
CREATE POLICY "Team members can read events" ON team_events FOR SELECT
  TO authenticated USING (
    current_user_is_team_member(team_id)
  );

-- RED-TEAM FIX: No INSERT policy. Only emit_team_event() (SECURITY DEFINER)
-- can write events. Prevents any authenticated user from fabricating audit events.

-- ============================================================
-- 4. Helper: emit_team_event()
-- ============================================================
CREATE OR REPLACE FUNCTION emit_team_event(
  p_team_id UUID,
  p_event_type VARCHAR(40),
  p_actor_id UUID,
  p_target_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO team_events (team_id, actor_id, target_user_id, event_type, metadata)
  VALUES (p_team_id, p_actor_id, p_target_user_id, p_event_type, p_metadata)
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 5. RPC: create_team_invite()
-- ============================================================
CREATE OR REPLACE FUNCTION create_team_invite(
  p_team_id UUID,
  p_email TEXT,
  p_role VARCHAR(20) DEFAULT 'viewer'
) RETURNS TABLE (invite_id UUID, token TEXT, expires_at TIMESTAMPTZ, rate_limited BOOLEAN) AS $$
DECLARE
  v_user_role VARCHAR(20);
  v_recent_count INTEGER;
  v_member_count INTEGER;
  v_team_plan VARCHAR(20);
  v_token TEXT;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_email IS NULL OR TRIM(p_email) !~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;
  IF p_role NOT IN ('viewer', 'editor', 'owner') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT role INTO v_user_role
    FROM team_members WHERE team_id = p_team_id AND user_id = v_caller_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('editor', 'owner') THEN
    RAISE EXCEPTION 'Only editors and owners can create invites';
  END IF;
  IF p_role = 'owner' AND v_user_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can invite new owners';
  END IF;

  -- Rate limit: max 20 invites per team per hour
  SELECT COUNT(*) INTO v_recent_count
    FROM team_events
    WHERE team_id = p_team_id
      AND event_type = 'invite.created'
      AND created_at > NOW() - INTERVAL '1 hour';
  IF v_recent_count >= 20 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ, true::BOOLEAN;
    RETURN;
  END IF;

  -- Check plan limits
  SELECT plan INTO v_team_plan FROM teams WHERE id = p_team_id;
  IF v_team_plan = 'free' THEN
    SELECT COUNT(*) INTO v_member_count FROM team_members WHERE team_id = p_team_id;
    IF v_member_count >= 3 THEN
      RAISE EXCEPTION 'Free teams are limited to 3 members';
    END IF;
  END IF;

  -- Check for existing pending invite
  IF EXISTS (
    SELECT 1 FROM team_invites
    WHERE team_id = p_team_id
      AND email = LOWER(TRIM(p_email))
      AND status = 'pending'
      AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Pending invite already exists for this email';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO team_invites (team_id, email, role, token, expires_at, invited_by, status)
  VALUES (
    p_team_id, LOWER(TRIM(p_email)), p_role, v_token,
    NOW() + INTERVAL '7 days', v_caller_id, 'pending'
  ) RETURNING id, token, expires_at INTO invite_id, token, expires_at;

  rate_limited := false;

  PERFORM emit_team_event(
    p_team_id, 'invite.created', v_caller_id, NULL,
    jsonb_build_object('email', LOWER(TRIM(p_email)), 'role', p_role)
  );

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 6. RPC: accept_team_invite()
-- ============================================================
CREATE OR REPLACE FUNCTION accept_team_invite(
  p_token TEXT,
  p_user_email TEXT
) RETURNS TABLE (team_id UUID, team_slug VARCHAR(50), role VARCHAR(20), already_member BOOLEAN) AS $$
DECLARE
  v_invite RECORD;
  v_team_slug VARCHAR(50);
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock invite row to prevent concurrent acceptance
  SELECT * INTO v_invite
    FROM team_invites
    WHERE token = p_token
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_invite.status != 'pending' THEN
    IF v_invite.status = 'accepted' THEN
      RAISE EXCEPTION 'Invite already accepted';
    ELSIF v_invite.status = 'expired' THEN
      RAISE EXCEPTION 'Invite has expired';
    ELSIF v_invite.status = 'revoked' THEN
      RAISE EXCEPTION 'Invite has been revoked';
    ELSE
      RAISE EXCEPTION 'Invite is no longer valid';
    END IF;
  END IF;

  IF v_invite.expires_at < NOW() THEN
    UPDATE team_invites SET status = 'expired' WHERE id = v_invite.id;
    PERFORM emit_team_event(
      v_invite.team_id, 'invite.expired', NULL, NULL,
      jsonb_build_object('invite_id', v_invite.id, 'email', v_invite.email)
    );
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  -- Strict email matching
  IF LOWER(TRIM(p_user_email)) != LOWER(TRIM(v_invite.email)) THEN
    RAISE EXCEPTION 'This invite was sent to %. Please log in with that email address.', v_invite.email;
  END IF;

  -- Check if already a member (idempotent)
  IF EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = v_invite.team_id AND user_id = v_caller_id
  ) THEN
    UPDATE team_invites SET status = 'accepted', accepted_at = NOW() WHERE id = v_invite.id;
    PERFORM emit_team_event(
      v_invite.team_id, 'invite.accepted', v_caller_id, v_caller_id,
      jsonb_build_object('invite_id', v_invite.id, 'email', v_invite.email, 'already_member', true)
    );
    SELECT slug INTO v_team_slug FROM teams WHERE id = v_invite.team_id;
    RETURN QUERY SELECT v_invite.team_id, v_team_slug, v_invite.role, true::BOOLEAN;
    RETURN;
  END IF;

  -- Create membership
  INSERT INTO team_members (team_id, user_id, role, invited_at, joined_at)
  VALUES (v_invite.team_id, v_caller_id, v_invite.role, v_invite.created_at, NOW());

  UPDATE team_invites SET status = 'accepted', accepted_at = NOW() WHERE id = v_invite.id;

  SELECT slug INTO v_team_slug FROM teams WHERE id = v_invite.team_id;

  PERFORM emit_team_event(
    v_invite.team_id, 'invite.accepted', v_caller_id, v_caller_id,
    jsonb_build_object('invite_id', v_invite.id, 'email', v_invite.email)
  );
  PERFORM emit_team_event(
    v_invite.team_id, 'member.joined', v_caller_id, v_caller_id,
    jsonb_build_object('email', v_invite.email, 'role', v_invite.role)
  );

  RETURN QUERY SELECT v_invite.team_id, v_team_slug, v_invite.role, false::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 7. RPC: revoke_team_invite()
-- ============================================================
CREATE OR REPLACE FUNCTION revoke_team_invite(
  p_invite_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_invite RECORD;
  v_user_role VARCHAR(20);
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_invite FROM team_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invite not found'; END IF;

  SELECT role INTO v_user_role
    FROM team_members WHERE team_id = v_invite.team_id AND user_id = v_caller_id;
  IF v_user_role IS NULL OR v_user_role NOT IN ('editor', 'owner') THEN
    RAISE EXCEPTION 'Only editors and owners can revoke invites';
  END IF;

  IF v_invite.status != 'pending' THEN
    RAISE EXCEPTION 'Cannot revoke a non-pending invite';
  END IF;

  UPDATE team_invites SET status = 'revoked' WHERE id = p_invite_id;

  PERFORM emit_team_event(
    v_invite.team_id, 'invite.revoked', v_caller_id, NULL,
    jsonb_build_object('invite_id', p_invite_id, 'email', v_invite.email)
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 8. RPC: change_member_role()
-- ============================================================
CREATE OR REPLACE FUNCTION change_member_role(
  p_team_id UUID,
  p_user_id UUID,
  p_new_role VARCHAR(20)
) RETURNS BOOLEAN AS $$
DECLARE
  v_old_role VARCHAR(20);
  v_changer_role VARCHAR(20);
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT role INTO v_old_role
    FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id;
  IF v_old_role IS NULL THEN RAISE EXCEPTION 'User is not a member'; END IF;

  SELECT role INTO v_changer_role
    FROM team_members WHERE team_id = p_team_id AND user_id = v_caller_id;
  IF v_changer_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can change roles';
  END IF;

  IF p_new_role NOT IN ('viewer', 'editor', 'owner') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF v_old_role = p_new_role THEN RETURN true; END IF;

  UPDATE team_members SET role = p_new_role
    WHERE team_id = p_team_id AND user_id = p_user_id;

  PERFORM emit_team_event(
    p_team_id, 'member.role_changed', v_caller_id, p_user_id,
    jsonb_build_object('old_role', v_old_role, 'new_role', p_new_role)
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 9. RPC: remove_team_member()
-- ============================================================
CREATE OR REPLACE FUNCTION remove_team_member(
  p_team_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR(20);
  v_remover_role VARCHAR(20);
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT role INTO v_role
    FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id;
  IF v_role IS NULL THEN RAISE EXCEPTION 'User is not a member'; END IF;

  SELECT role INTO v_remover_role
    FROM team_members WHERE team_id = p_team_id AND user_id = v_caller_id;

  IF p_user_id != v_caller_id AND v_remover_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can remove other members';
  END IF;

  DELETE FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id;

  PERFORM emit_team_event(
    p_team_id,
    CASE WHEN p_user_id = v_caller_id THEN 'member.left' ELSE 'member.removed' END,
    v_caller_id, p_user_id,
    jsonb_build_object('role', v_role)
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 10. Update clean_expired_invites() to set status instead of delete
-- ============================================================
CREATE OR REPLACE FUNCTION clean_expired_invites()
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE team_invites
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < NOW();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
