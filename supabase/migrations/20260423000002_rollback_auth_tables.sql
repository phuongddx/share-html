-- Rollback migration: Remove auth tables and columns

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP TRIGGER IF EXISTS set_profile_updated_at ON user_profiles;

DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS user_profiles;

DROP POLICY IF EXISTS "Owner update share" ON shares;

DROP INDEX IF EXISTS idx_shares_user_created;
DROP INDEX IF EXISTS idx_shares_user_id;

ALTER TABLE shares DROP COLUMN IF EXISTS title;
ALTER TABLE shares DROP COLUMN IF EXISTS user_id;
