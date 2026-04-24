-- API keys table for REST API authentication.
-- Each key is hashed (SHA-256) so the raw key is never stored.
-- The prefix is stored for display purposes (e.g. "shk_a1b2c3d4...").

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  key_prefix VARCHAR(12) NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ NULL
);

-- Fast lookup by hash (only active keys)
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
-- List keys by user
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- Row-level security: users can only manage their own keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage keys" ON api_keys FOR ALL
  USING (user_id = (SELECT auth.uid()));
