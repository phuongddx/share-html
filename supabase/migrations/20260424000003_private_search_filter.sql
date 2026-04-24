-- Phase 08: Update search_shares RPC to exclude private documents from public search results

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
    AND (s.is_private IS NOT TRUE)
  ORDER BY rank DESC, s.created_at DESC
  LIMIT result_limit OFFSET result_offset;
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT ''::VARCHAR, ''::VARCHAR, NOW()::TIMESTAMPTZ, 0::INTEGER, NOW()::TIMESTAMPTZ, ''::TEXT, 0::REAL LIMIT 0;
END;
$$ LANGUAGE plpgsql;
