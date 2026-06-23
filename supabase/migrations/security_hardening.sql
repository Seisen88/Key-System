-- ── Security hardening ────────────────────────────────────────────────────────
-- Run in Supabase SQL Editor

-- 1. Remove any permissive anon/public SELECT policies on the keys table.
--    Key lookups now go through the lookup-key edge function (service role).
--    Drop all known policy names — add more if yours has a different name.
DROP POLICY IF EXISTS "anon_read_keys"        ON keys;
DROP POLICY IF EXISTS "public_read_keys"       ON keys;
DROP POLICY IF EXISTS "Public read keys"       ON keys;
DROP POLICY IF EXISTS "anon select keys"       ON keys;
DROP POLICY IF EXISTS "anyone_read_keys"       ON keys;
DROP POLICY IF EXISTS "read_keys"              ON keys;
DROP POLICY IF EXISTS "select_keys"            ON keys;

-- After running this, verify with:
--   SELECT policyname FROM pg_policies WHERE tablename = 'keys';
-- Only authenticated (admin) policies should remain.

-- 2. Ensure rate_limits has no permissive policies (service role only).
--    RLS is already enabled from 001_init.sql with no policies = no anon access.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- 3. Authenticated admins need SELECT on keys for the admin panel.
--    Add this only if it doesn't already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'keys' AND policyname = 'admin_read_keys'
  ) THEN
    EXECUTE 'CREATE POLICY "admin_read_keys" ON keys FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'keys' AND policyname = 'admin_all_keys'
  ) THEN
    EXECUTE 'CREATE POLICY "admin_all_keys" ON keys FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;
