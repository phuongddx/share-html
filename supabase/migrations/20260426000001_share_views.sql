-- share_views: individual view tracking for analytics dashboard
CREATE TABLE IF NOT EXISTS share_views (
  id BIGSERIAL PRIMARY KEY,
  share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  referrer TEXT,
  referrer_source VARCHAR(50),
  country_code VARCHAR(2),
  visitor_hash VARCHAR(64),
  is_unique BOOLEAN DEFAULT false
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_share_views_share_id ON share_views(share_id);
CREATE INDEX IF NOT EXISTS idx_share_views_viewed_at ON share_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_views_share_date ON share_views(share_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_views_visitor ON share_views(share_id, visitor_hash);
CREATE INDEX IF NOT EXISTS idx_share_views_source ON share_views(share_id, referrer_source);

-- RLS: server writes via service_role, server reads for owner data
ALTER TABLE share_views ENABLE ROW LEVEL SECURITY;
-- No SELECT policy — data accessed only via RPCs (SECURITY DEFINER)
-- No INSERT policy — API route uses service_role

-- RPC: record a view AND increment view_count in one call (idempotent dedup within 1 hour)
-- Uses advisory lock to prevent TOCTOU race on concurrent same-visitor views
CREATE OR REPLACE FUNCTION record_and_increment_share_view(
  p_share_slug VARCHAR,
  p_visitor_hash VARCHAR(64) DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL,
  p_referrer_source VARCHAR(50) DEFAULT 'direct',
  p_country_code VARCHAR(2) DEFAULT NULL
) RETURNS TABLE(id BIGINT, is_unique BOOLEAN, share_id UUID, tracking_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_unique BOOLEAN;
  v_id BIGINT;
  v_share_id UUID;
  v_tracking_token TEXT;
BEGIN
  SELECT id INTO v_share_id FROM shares WHERE slug = p_share_slug LIMIT 1;
  IF v_share_id IS NULL THEN
    RAISE EXCEPTION 'Share not found: %', p_share_slug;
  END IF;

  -- Advisory lock serializes concurrent inserts for same share+visitor
  PERFORM pg_advisory_xact_lock(hashtext(p_share_slug || p_visitor_hash));

  -- Check if this visitor viewed this share in the last hour
  SELECT NOT EXISTS (
    SELECT 1 FROM share_views
    WHERE share_id = v_share_id
      AND visitor_hash = p_visitor_hash
      AND viewed_at > NOW() - INTERVAL '1 hour'
  ) INTO v_is_unique;

  INSERT INTO share_views (share_id, referrer, referrer_source, country_code, visitor_hash, is_unique)
  VALUES (v_share_id, p_referrer, p_referrer_source, p_country_code, p_visitor_hash, v_is_unique)
  RETURNING id, is_unique INTO v_id, v_is_unique;

  -- Increment view_count in same RPC (halves DB round trips)
  UPDATE shares SET view_count = view_count + 1 WHERE id = v_share_id;

  -- Generate short-lived signed tracking token for client-side ping
  -- Token = HMAC-SHA256(share_id || timestamp, SERVER_SECRET) encoded as hex
  v_tracking_token := encode(
    hmac(
      v_share_id::TEXT || '|' || extract(epoch from NOW())::TEXT,
      current_setting('app.server_secret', true),
      'sha256'
    ),
    'hex'
  ) || '|' || extract(epoch from NOW())::TEXT;

  RETURN QUERY SELECT v_id, v_is_unique, v_share_id, v_tracking_token;
END;
$$;

-- RPC: get aggregated view data for a share
CREATE OR REPLACE FUNCTION get_share_analytics(
  p_share_id UUID,
  p_days INT DEFAULT 30
) RETURNS TABLE(
  total_views BIGINT,
  unique_views BIGINT,
  views_today BIGINT,
  views_7d BIGINT,
  avg_daily_views NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_unique),
    COUNT(*) FILTER (WHERE viewed_at > DATE_TRUNC('day', NOW())),
    COUNT(*) FILTER (WHERE viewed_at > NOW() - INTERVAL '7 days'),
    CASE WHEN p_days > 0
      THEN ROUND(COUNT(*)::NUMERIC / p_days, 1)
      ELSE 0
    END
  FROM share_views
  WHERE share_id = p_share_id
    AND viewed_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$;

-- RPC: get daily view counts for chart (last N days)
CREATE OR REPLACE FUNCTION get_share_view_timeseries(
  p_share_id UUID,
  p_days INT DEFAULT 30
) RETURNS TABLE(
  date DATE,
  views BIGINT,
  unique_views BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('day', d)::DATE AS date,
    COALESCE(COUNT(v.id), 0)::BIGINT,
    COALESCE(COUNT(v.id) FILTER (WHERE v.is_unique), 0)::BIGINT
  FROM generate_series(
    DATE_TRUNC('day', NOW()) - (p_days - 1 || ' days')::INTERVAL,
    DATE_TRUNC('day', NOW()),
    '1 day'::INTERVAL
  ) d
  LEFT JOIN share_views v ON v.share_id = p_share_id
    AND v.viewed_at >= DATE_TRUNC('day', d)
    AND v.viewed_at < DATE_TRUNC('day', d) + INTERVAL '1 day'
  GROUP BY d
  ORDER BY d;
END;
$$;

-- RPC: get referrer breakdown for a share
CREATE OR REPLACE FUNCTION get_share_referrers(
  p_share_id UUID,
  p_days INT DEFAULT 30,
  p_limit INT DEFAULT 10
) RETURNS TABLE(
  referrer_source VARCHAR(50),
  views BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(referrer_source, 'direct'::VARCHAR(50)),
    COUNT(*)::BIGINT
  FROM share_views
  WHERE share_id = p_share_id
    AND viewed_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY referrer_source
  ORDER BY views DESC
  LIMIT p_limit;
END;
$$;

-- RPC: get geo breakdown for a share
CREATE OR REPLACE FUNCTION get_share_geo(
  p_share_id UUID,
  p_days INT DEFAULT 30,
  p_limit INT DEFAULT 10
) RETURNS TABLE(
  country_code VARCHAR(2),
  views BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(country_code, '??'::VARCHAR(2)),
    COUNT(*)::BIGINT
  FROM share_views
  WHERE share_id = p_share_id
    AND viewed_at > NOW() - (p_days || ' days')::INTERVAL
    AND country_code IS NOT NULL
  GROUP BY country_code
  ORDER BY views DESC
  LIMIT p_limit;
END;
$$;

-- RPC: get user's top performing shares
CREATE OR REPLACE FUNCTION get_user_top_shares(
  p_user_id UUID,
  p_limit INT DEFAULT 5
) RETURNS TABLE(
  share_id UUID,
  slug VARCHAR,
  title TEXT,
  total_views BIGINT,
  unique_views BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.slug,
    COALESCE(s.title, s.filename),
    COALESCE(v_agg.total_views, 0)::BIGINT,
    COALESCE(v_agg.unique_views, 0)::BIGINT
  FROM shares s
  LEFT JOIN (
    SELECT share_id,
      COUNT(*) AS total_views,
      COUNT(*) FILTER (WHERE is_unique) AS unique_views
    FROM share_views
    WHERE viewed_at > NOW() - INTERVAL '30 days'
    GROUP BY share_id
  ) v_agg ON v_agg.share_id = s.id
  WHERE s.user_id = p_user_id
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
  GROUP BY s.id, s.slug, s.title, s.filename, v_agg.total_views, v_agg.unique_views
  ORDER BY v_agg.total_views DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- Cleanup: delete rows older than 90 days
-- Run via pg_cron (Supabase hosted) or manual SQL on schedule
CREATE OR REPLACE FUNCTION clean_old_share_views(p_days INT DEFAULT 90)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM share_views
  WHERE viewed_at < NOW() - (p_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;
