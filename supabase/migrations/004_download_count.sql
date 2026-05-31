-- Run this in Supabase SQL Editor

ALTER TABLE site_stats ADD COLUMN IF NOT EXISTS downloads bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_downloads()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE site_stats SET downloads = downloads + 1 WHERE id = 1 RETURNING downloads;
$$;
