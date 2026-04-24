-- Add password_hash column for optional password protection
ALTER TABLE shares ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- password_hash is a bcrypt hash (one-way). Access control enforced at application layer:
-- only admin client queries password_hash; anon client never requests it directly.
COMMENT ON COLUMN shares.password_hash IS 'bcrypt hash of share password. NULL = no password (login required to view).';

-- Rollback: ALTER TABLE shares DROP COLUMN IF EXISTS password_hash;
