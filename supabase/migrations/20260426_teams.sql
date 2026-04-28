-- =============================================================================
-- PHASE 3: Team Workspaces — Database Schema
-- =============================================================================

-- 1. Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_slug ON teams(slug);
CREATE INDEX idx_teams_created_by ON teams(created_by);

-- 2. Team members junction
CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- 3. Team invites
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner', 'editor', 'viewer')),
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_team_invites_token ON team_invites(token);
CREATE INDEX idx_team_invites_email ON team_invites(email);

-- 4. Team shares junction
CREATE TABLE IF NOT EXISTS team_shares (
  share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (share_id, team_id)
);

CREATE INDEX idx_team_shares_team_id ON team_shares(team_id);
CREATE INDEX idx_team_shares_share_id ON team_shares(share_id);

-- 5. Add team_id column to api_keys (nullable — personal keys have null)
ALTER TABLE api_keys ADD COLUMN team_id UUID NULL REFERENCES teams(id) ON DELETE CASCADE;
CREATE INDEX idx_api_keys_team_id ON api_keys(team_id) WHERE team_id IS NOT NULL AND revoked_at IS NULL;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- TEAMS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Members can view their teams
CREATE POLICY "Team members can read" ON teams FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM team_members WHERE team_id = teams.id AND user_id = (SELECT auth.uid()))
  );

-- Anyone authenticated can create a team (becomes owner via trigger)
CREATE POLICY "Authenticated users can create teams" ON teams FOR INSERT
  TO authenticated WITH CHECK (true);

-- Only owners can update team settings
CREATE POLICY "Team owners can update" ON teams FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = teams.id AND user_id = (SELECT auth.uid()) AND role = 'owner'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = teams.id AND user_id = (SELECT auth.uid()) AND role = 'owner'
    )
  );

-- Only owners can delete team
CREATE POLICY "Team owners can delete" ON teams FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = teams.id AND user_id = (SELECT auth.uid()) AND role = 'owner'
    )
  );

-- TEAM_MEMBERS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Members can view all members in their teams
CREATE POLICY "Team members can read members" ON team_members FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id AND tm.user_id = (SELECT auth.uid())
    )
  );

-- Only owners/editors can insert new members (invite acceptance uses service_role)
CREATE POLICY "Owners and editors can add members" ON team_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_members.team_id AND user_id = (SELECT auth.uid()) AND role IN ('owner', 'editor')
    )
  );

-- Owners can update member roles (but not their own role — app-level check)
CREATE POLICY "Owners can update member roles" ON team_members FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_members.team_id AND user_id = (SELECT auth.uid()) AND role = 'owner'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_members.team_id AND user_id = (SELECT auth.uid()) AND role = 'owner'
    )
  );

-- Owners can remove members; members can leave (delete own row)
CREATE POLICY "Members can leave, owners can remove" ON team_members FOR DELETE
  TO authenticated USING (
    team_members.user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_members.team_id AND user_id = (SELECT auth.uid()) AND role = 'owner'
    )
  );

-- TEAM_INVITES
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Team members can view invites for their team
CREATE POLICY "Team members can read invites" ON team_invites FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_invites.team_id AND user_id = (SELECT auth.uid())
    )
  );

-- Owners/editors can create invites
CREATE POLICY "Owners and editors can create invites" ON team_invites FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_invites.team_id AND user_id = (SELECT auth.uid()) AND role IN ('owner', 'editor')
    )
  );

-- Owners/editors can update invites (accept/cancel)
CREATE POLICY "Owners and editors can update invites" ON team_invites FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_invites.team_id AND user_id = (SELECT auth.uid()) AND role IN ('owner', 'editor')
    )
  );

-- Owners/editors can delete invites
CREATE POLICY "Owners and editors can delete invites" ON team_invites FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_invites.team_id AND user_id = (SELECT auth.uid()) AND role IN ('owner', 'editor')
    )
  );

-- TEAM_SHARES
ALTER TABLE team_shares ENABLE ROW LEVEL SECURITY;

-- Team members can read team shares
CREATE POLICY "Team members can read team shares" ON team_shares FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_shares.team_id AND user_id = (SELECT auth.uid())
    )
  );

-- Editors and owners can add shares to team
CREATE POLICY "Editors can add shares to team" ON team_shares FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_shares.team_id AND user_id = (SELECT auth.uid()) AND role IN ('owner', 'editor')
    )
  );

-- Editors and owners can remove shares from team
CREATE POLICY "Editors can remove shares from team" ON team_shares FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = team_shares.team_id AND user_id = (SELECT auth.uid()) AND role IN ('owner', 'editor')
    )
  );

-- Red Team Fix: 4 — Add RLS policy for team-scoped API keys so team owners/editors can manage them
-- API_KEYS (team-scoped)
-- Note: api_keys table already exists from previous migrations. RLS may already be enabled.
-- Ensure RLS is enabled if not already:
-- ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Team editors can manage (read, insert, update, revoke) team-scoped API keys
CREATE POLICY "Team editors can manage team keys" ON api_keys FOR ALL
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = api_keys.team_id AND user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_id = api_keys.team_id AND user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Get user's role in a team (returns NULL if not a member)
CREATE OR REPLACE FUNCTION get_team_role(p_team_id UUID, p_user_id UUID)
RETURNS VARCHAR(20) AS $$
  SELECT role FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Check if user has at least the given role level
-- Role hierarchy: viewer=1, editor=2, owner=3
CREATE OR REPLACE FUNCTION has_min_team_role(p_team_id UUID, p_user_id UUID, p_min_role VARCHAR(20))
RETURNS BOOLEAN AS $$
DECLARE
  v_current VARCHAR(20);
  v_levels INTEGER;
  v_min INTEGER;
BEGIN
  SELECT role INTO v_current FROM team_members
    WHERE team_id = p_team_id AND user_id = p_user_id;

  IF v_current IS NULL THEN RETURN false; END IF;

  v_levels := CASE v_current WHEN 'viewer' THEN 1 WHEN 'editor' THEN 2 WHEN 'owner' THEN 3 END;
  v_min := CASE p_min_role WHEN 'viewer' THEN 1 WHEN 'editor' THEN 2 WHEN 'owner' THEN 3 END;

  RETURN v_levels >= v_min;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Auto-add creator as owner when team is created
CREATE OR REPLACE FUNCTION add_team_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (team_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_team_created
  AFTER INSERT ON teams
  FOR EACH ROW EXECUTE FUNCTION add_team_owner();

-- Clean expired invites (run periodically via cron/pg_cron or Supabase Edge Function)
CREATE OR REPLACE FUNCTION clean_expired_invites()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM team_invites
    WHERE expires_at < NOW() AND accepted_at IS NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enforce single owner per team (prevent owner from demoting themselves if they're the only one)
CREATE OR REPLACE FUNCTION prevent_last_owner_demotion()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role != 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count FROM team_members
      WHERE team_id = NEW.team_id AND role = 'owner';

    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last owner of a team';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count FROM team_members
      WHERE team_id = OLD.team_id AND role = 'owner';

    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner of a team';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER check_last_owner
  BEFORE UPDATE OR DELETE ON team_members
  FOR EACH ROW EXECUTE FUNCTION prevent_last_owner_demotion();

-- Free plan limits: max 3 members per team
-- Red Team Fix: 12 — Use AFTER INSERT instead of BEFORE INSERT to avoid race condition.
-- BEFORE INSERT does NOT see the new row, so the count is stale under concurrent inserts.
-- AFTER INSERT sees the committed row, so COUNT is accurate. We raise an exception to
-- roll back the offending insert. Also use SELECT ... FOR UPDATE on the team row to
-- serialize concurrent inserts and prevent the race entirely.
CREATE OR REPLACE FUNCTION enforce_team_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_member_count INTEGER;
  v_plan VARCHAR(20);
BEGIN
  -- Lock the team row to serialize concurrent member inserts
  SELECT plan INTO v_plan FROM teams WHERE id = NEW.team_id FOR UPDATE;

  IF v_plan = 'free' THEN
    -- AFTER INSERT: the new row IS visible, so COUNT is accurate
    SELECT COUNT(*) INTO v_member_count FROM team_members WHERE team_id = NEW.team_id;

    IF v_member_count > 3 THEN
      RAISE EXCEPTION 'Free teams are limited to 3 members. Upgrade to Pro for unlimited members.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER enforce_plan_limits
  AFTER INSERT ON team_members
  FOR EACH ROW EXECUTE FUNCTION enforce_team_plan_limits();
