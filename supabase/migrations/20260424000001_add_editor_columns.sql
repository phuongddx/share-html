-- Phase 01: DB Schema Extension for MDtolink-like features
-- Adds: custom_slug, source, is_private, updated_at columns to shares table
-- All columns nullable or have defaults for zero-downtime migration

-- Add new columns
ALTER TABLE shares
  ADD COLUMN IF NOT EXISTS custom_slug VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Partial unique index on custom_slug (only enforce uniqueness where set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shares_custom_slug
  ON shares(custom_slug) WHERE custom_slug IS NOT NULL;

-- Index on source for filtering editor vs upload content
CREATE INDEX IF NOT EXISTS idx_shares_source ON shares(source);

-- Index on is_private for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_shares_is_private ON shares(is_private) WHERE is_private = true;

-- Drop existing public read policy and recreate with privacy check
DROP POLICY IF EXISTS "Public read access" ON shares;
CREATE POLICY "Public read access" ON shares FOR SELECT
  USING (NOT is_private OR user_id = (SELECT auth.uid()));
