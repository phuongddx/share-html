-- Migration: Add auth support — user_profiles, favorites, user_id on shares
-- Up migration

-- 1. Add user_id and title columns to shares
ALTER TABLE shares ADD COLUMN user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE shares ADD COLUMN title VARCHAR(255);
CREATE INDEX idx_shares_user_id ON shares(user_id);
CREATE INDEX idx_shares_user_created ON shares(user_id, created_at DESC);

-- 2. Create user_profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Owner update profile" ON user_profiles FOR UPDATE TO authenticated USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);
CREATE POLICY "Owner insert profile" ON user_profiles FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);

-- 3. Create favorites table
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, share_id)
);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner read favorites" ON favorites FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Owner insert favorite" ON favorites FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Owner delete favorite" ON favorites FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- 4. RLS: owner can update their own shares
-- NOTE: No DELETE policy — existing token-based delete uses service_role (bypasses RLS).
-- Dashboard deletes go through API route using service_role too.
CREATE POLICY "Owner update share" ON shares FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- 5. Auto-create user_profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      regexp_replace(NEW.raw_user_meta_data->>'full_name', '<[^>]+>', '', 'g'),
      regexp_replace(NEW.raw_user_meta_data->>'name', '<[^>]+>', '', 'g'),
      regexp_replace(NEW.raw_user_meta_data->>'user_name', '<[^>]+>', '', 'g'),
      ''
    ),
    CASE
      WHEN NEW.raw_user_meta_data->>'avatar_url' LIKE 'https://%' THEN NEW.raw_user_meta_data->>'avatar_url'
      WHEN NEW.raw_user_meta_data->>'picture' LIKE 'https://%' THEN NEW.raw_user_meta_data->>'picture'
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. Auto-update updated_at on user_profiles
CREATE EXTENSION IF NOT EXISTS moddatetime;
CREATE TRIGGER set_profile_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
