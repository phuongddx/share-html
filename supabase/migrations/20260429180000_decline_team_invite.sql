-- RPC: decline_team_invite()
-- Mirrors accept_team_invite pattern: auth guard, email match, status/expiry checks, event emission.

CREATE OR REPLACE FUNCTION decline_team_invite(
  p_token      TEXT,
  p_user_email TEXT
) RETURNS TABLE (team_id UUID, team_slug VARCHAR(50), declined BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_invite    RECORD;
  v_team_slug VARCHAR(50);
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM team_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_invite.status = 'declined' THEN
    RAISE EXCEPTION 'Invite already declined';
  END IF;
  IF v_invite.status = 'accepted' THEN
    RAISE EXCEPTION 'Invite already accepted';
  END IF;
  IF v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_invite.expires_at < NOW() THEN
    UPDATE team_invites SET status = 'expired' WHERE id = v_invite.id;
    PERFORM emit_team_event(v_invite.team_id, 'invite.expired', NULL, NULL,
      jsonb_build_object('invite_id', v_invite.id));
    RAISE EXCEPTION 'Invite expired';
  END IF;

  IF LOWER(TRIM(v_invite.email)) != LOWER(TRIM(p_user_email)) THEN
    RAISE EXCEPTION 'This invite was sent to %. Please log in with that email address.', v_invite.email;
  END IF;

  SELECT slug INTO v_team_slug FROM teams WHERE id = v_invite.team_id;

  UPDATE team_invites SET status = 'declined' WHERE id = v_invite.id;

  PERFORM emit_team_event(
    v_invite.team_id, 'invite.declined', v_caller_id, v_caller_id,
    jsonb_build_object('invite_id', v_invite.id, 'email', v_invite.email)
  );

  RETURN QUERY SELECT v_invite.team_id, v_team_slug, TRUE::BOOLEAN;
END;
$$;
