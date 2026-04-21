-- shares table
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(10) UNIQUE NOT NULL,
  filename VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  content_text TEXT,
  search_vec TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(filename, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(content_text, '')), 'B')
  ) STORED,
  file_size INTEGER,
  mime_type VARCHAR(100) DEFAULT 'text/html',
  delete_token VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  view_count INTEGER DEFAULT 0,
  CONSTRAINT content_text_limit CHECK (length(content_text) <= 100000)
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_slug ON shares(slug);
CREATE INDEX IF NOT EXISTS idx_shares_search ON shares USING GIN(search_vec);
CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires_at);
CREATE INDEX IF NOT EXISTS idx_shares_created ON shares(created_at DESC);

-- Enable RLS
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- RLS: allow public read (for search/view), server handles mutations via service_role
CREATE POLICY "Public read access" ON shares FOR SELECT USING (true);

-- RPC function for full-text search
CREATE OR REPLACE FUNCTION search_shares(query_term TEXT, result_limit INT DEFAULT 20, result_offset INT DEFAULT 0)
RETURNS TABLE (
  slug VARCHAR, filename VARCHAR, created_at TIMESTAMPTZ, view_count INTEGER,
  expires_at TIMESTAMPTZ, snippet TEXT, rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.slug, s.filename, s.created_at, s.view_count, s.expires_at,
    ts_headline('english', s.content_text, websearch_to_tsquery('english', query_term)) as snippet,
    ts_rank(s.search_vec, websearch_to_tsquery('english', query_term)) as rank
  FROM shares s
  WHERE s.search_vec @@ websearch_to_tsquery('english', query_term)
    AND s.expires_at > NOW()
  ORDER BY rank DESC, s.created_at DESC
  LIMIT result_limit OFFSET result_offset;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT ''::VARCHAR, ''::VARCHAR, NOW()::TIMESTAMPTZ, 0::INTEGER, NOW()::TIMESTAMPTZ, ''::TEXT, 0::REAL LIMIT 0;
END;
$$ LANGUAGE plpgsql;

-- RPC function for atomic view count increment
CREATE OR REPLACE FUNCTION increment_view_count(share_slug VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE shares SET view_count = view_count + 1 WHERE slug = share_slug RETURNING view_count INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup: Manual only. Run via Supabase dashboard or psql when needed.
-- 1. Query expired shares: SELECT id, storage_path FROM shares WHERE expires_at < NOW();
-- 2. Delete storage objects via Supabase Storage API or dashboard
-- 3. DELETE FROM shares WHERE expires_at < NOW();

-- Storage bucket: "html-files" (create via Supabase Dashboard)
-- Public: true, Max file size: 10MB
-- Storage path format: {uuid-v4}.html
