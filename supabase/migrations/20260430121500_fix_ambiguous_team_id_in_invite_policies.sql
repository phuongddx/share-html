-- Revert: previous (SELECT team_id) approach didn't resolve the ambiguity.
-- The actual fix is in app/invite/accept/page.tsx — using table alias
-- "team_invites!public(...)" in the PostgREST select to qualify column names
-- and avoid ambiguous "id" when JOINed with teams.

-- TEAM_INVITES — revert to working bare team_id (PostgreSQL normalizes table qualifiers)
DROP POLICY IF EXISTS "Team members can read invites" ON team_invites;
CREATE POLICY "Team members can read invites" ON team_invites FOR SELECT
  TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL
    AND current_user_is_team_member(team_id)
  );

DROP POLICY IF EXISTS "Owners and editors can create invites" ON team_invites;
CREATE POLICY "Owners and editors can create invites" ON team_invites FOR INSERT
  TO authenticated WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND current_user_has_team_role(team_id, ARRAY['owner', 'editor'])
  );

DROP POLICY IF EXISTS "Owners and editors can update invites" ON team_invites;
CREATE POLICY "Owners and editors can update invites" ON team_invites FOR UPDATE
  TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL
    AND current_user_has_team_role(team_id, ARRAY['owner', 'editor'])
  );

DROP POLICY IF EXISTS "Owners and editors can delete invites" ON team_invites;
CREATE POLICY "Owners and editors can delete invites" ON team_invites FOR DELETE
  TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL
    AND current_user_has_team_role(team_id, ARRAY['owner', 'editor'])
  );

-- TEAM_MEMBERS — revert
DROP POLICY IF EXISTS "Team members can read members" ON team_members;
CREATE POLICY "Team members can read members" ON team_members FOR SELECT
  TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL
    AND current_user_is_team_member(team_id)
  );

DROP POLICY IF EXISTS "Owners and editors can add members" ON team_members;
CREATE POLICY "Owners and editors can add members" ON team_members FOR INSERT
  TO authenticated WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND current_user_has_team_role(team_id, ARRAY['owner', 'editor'])
  );

DROP POLICY IF EXISTS "Owners can update member roles" ON team_members;
CREATE POLICY "Owners can update member roles" ON team_members FOR UPDATE
  TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL
    AND current_user_has_team_role(team_id, ARRAY['owner'])
  ) WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND current_user_has_team_role(team_id, ARRAY['owner'])
  );

DROP POLICY IF EXISTS "Members can leave, owners can remove" ON team_members;
CREATE POLICY "Members can leave, owners can remove" ON team_members FOR DELETE
  TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (user_id = (SELECT auth.uid())
         OR current_user_has_team_role(team_id, ARRAY['owner']))
  );

-- TEAM_SHARES — revert
DROP POLICY IF EXISTS "Team members can read team shares" ON team_shares;
CREATE POLICY "Team members can read team shares" ON team_shares FOR SELECT
  TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL
    AND current_user_is_team_member(team_id)
  );

DROP POLICY IF EXISTS "Editors can add shares to team" ON team_shares;
CREATE POLICY "Editors can add shares to team" ON team_shares FOR INSERT
  TO authenticated WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND current_user_has_team_role(team_id, ARRAY['owner', 'editor'])
  );

DROP POLICY IF EXISTS "Editors can remove shares from team" ON team_shares;
CREATE POLICY "Editors can remove shares from team" ON team_shares FOR DELETE
  TO authenticated USING (
    (SELECT auth.uid()) IS NOT NULL
    AND current_user_has_team_role(team_id, ARRAY['owner', 'editor'])
  );
