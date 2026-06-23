-- AUTO-GENERATED: paste this entire file into Supabase SQL editor

-- ────────────────────────────────────────────
-- 001_init.sql
-- ────────────────────────────────────────────
-- Run this in Supabase SQL Editor

-- ── Integrations (work.ink, lootlabs, lockr, etc.) ──────────────
CREATE TABLE integrations (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text        NOT NULL UNIQUE,       -- slug: "workink"
  display_name     text        NOT NULL,              -- shown on website: "work.ink"
  logo_url         text,                              -- optional logo URL
  emoji            text        DEFAULT '🔗',          -- fallback icon
  redirect_url     text        NOT NULL,              -- the locker URL on their platform
  checkpoint_count int         DEFAULT 1,
  enabled          boolean     DEFAULT true,
  sort_order       int         DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

-- ── Keys ─────────────────────────────────────────────────────────
CREATE TABLE keys (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  key_value  text        NOT NULL UNIQUE,
  hwid       text,                                   -- null until first app validation
  provider   text        NOT NULL,
  ip_address text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- ── Rate limit tracking (1 key per IP per 24h) ───────────────────
CREATE TABLE rate_limits (
  ip_address  text        PRIMARY KEY,
  last_keygen timestamptz NOT NULL
);

-- ── RLS: allow edge functions (service role) to do everything ────
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE keys         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits  ENABLE ROW LEVEL SECURITY;

-- Public can read enabled integrations
CREATE POLICY "public read integrations"
  ON integrations FOR SELECT USING (enabled = true);

-- Service role bypasses RLS (edge functions use service role)

-- ── Seed default integrations ─────────────────────────────────────
-- Replace redirect_url with your actual locker URLs from each platform

INSERT INTO integrations (name, display_name, emoji, redirect_url, checkpoint_count, sort_order)
VALUES
  ('workink',  'work.ink',  '🔗', 'https://work.ink/YOUR_LOCKER_ID',      1, 1),
  ('lootlabs', 'LootLabs',  '💰', 'https://lootlabs.gg/YOUR_LOCKER_ID',   2, 2),
  ('lockr',    'Linkr',     '🔒', 'https://linkr.bio/YOUR_LOCKER_ID',      1, 3);

-- ────────────────────────────────────────────
-- 002_tiers.sql
-- ────────────────────────────────────────────
-- Run in Supabase SQL Editor

CREATE TABLE tiers (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  hours        int         NOT NULL UNIQUE,
  label        text        NOT NULL,
  checkpoints  int         NOT NULL DEFAULT 1,
  color        text        NOT NULL DEFAULT 'accent',   -- accent | purple | yellow | red
  enabled      boolean     DEFAULT true,
  sort_order   int         DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read tiers"
  ON tiers FOR SELECT USING (enabled = true);

-- Default tiers
INSERT INTO tiers (hours, label, checkpoints, color, sort_order) VALUES
  (6,  '6 Hours',  1, 'accent',  1),
  (12, '12 Hours', 2, 'purple',  2),
  (24, '24 Hours', 4, 'yellow',  3);

-- ────────────────────────────────────────────
-- 002_admin_columns.sql
-- ────────────────────────────────────────────
-- Run this in Supabase SQL Editor to add admin dashboard columns
ALTER TABLE keys ADD COLUMN IF NOT EXISTS key_name           text        DEFAULT '';
ALTER TABLE keys ADD COLUMN IF NOT EXISTS discord_user_id    text        DEFAULT '';
ALTER TABLE keys ADD COLUMN IF NOT EXISTS discord_username   text        DEFAULT '';
ALTER TABLE keys ADD COLUMN IF NOT EXISTS is_premium         boolean     DEFAULT false;
ALTER TABLE keys ADD COLUMN IF NOT EXISTS is_one_time        boolean     DEFAULT false;
ALTER TABLE keys ADD COLUMN IF NOT EXISTS expiry_on_first_use boolean    DEFAULT false;
ALTER TABLE keys ADD COLUMN IF NOT EXISTS no_hwid_binding    boolean     DEFAULT false;
ALTER TABLE keys ADD COLUMN IF NOT EXISTS is_disabled        boolean     DEFAULT false;
ALTER TABLE keys ADD COLUMN IF NOT EXISTS disabled_until     timestamptz;
ALTER TABLE keys ADD COLUMN IF NOT EXISTS folder             text        DEFAULT '';

-- ────────────────────────────────────────────
-- 003_lootlabs_tokens.sql
-- ────────────────────────────────────────────
-- Run in Supabase SQL Editor

CREATE TABLE lootlabs_tokens (
  puid        text        PRIMARY KEY,
  status      text        NOT NULL DEFAULT 'pending',  -- 'pending' | 'verified' | 'used'
  hours       int         NOT NULL,
  ip          text,
  unique_id   text,
  created_at  timestamptz DEFAULT now(),
  verified_at timestamptz
);

ALTER TABLE lootlabs_tokens ENABLE ROW LEVEL SECURITY;
-- Service role (edge functions) bypasses RLS — no public policy needed

-- ────────────────────────────────────────────
-- 003_site_visits.sql
-- ────────────────────────────────────────────
-- Run this in Supabase SQL Editor

CREATE TABLE site_stats (
  id      int  PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  visits  bigint NOT NULL DEFAULT 0
);

INSERT INTO site_stats (id, visits) VALUES (1, 0)
  ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE site_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read site_stats"
  ON site_stats FOR SELECT USING (true);

-- Atomic increment RPC (runs as security definer so anon role can call it)
CREATE OR REPLACE FUNCTION increment_visits()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE site_stats SET visits = visits + 1 WHERE id = 1 RETURNING visits;
$$;

-- ────────────────────────────────────────────
-- 004_download_count.sql
-- ────────────────────────────────────────────
-- Run this in Supabase SQL Editor

ALTER TABLE site_stats ADD COLUMN IF NOT EXISTS downloads bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_downloads()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE site_stats SET downloads = downloads + 1 WHERE id = 1 RETURNING downloads;
$$;

-- ────────────────────────────────────────────
-- 005_update_tiers.sql
-- ────────────────────────────────────────────
-- Remove old 6h and 12h tiers, update 24h, add 48h
DELETE FROM tiers WHERE hours IN (6, 12);

INSERT INTO tiers (hours, label, checkpoints, color, sort_order)
VALUES (48, '48 Hours', 2, 'purple', 2)
ON CONFLICT (hours) DO NOTHING;

UPDATE tiers SET label = '24 Hours', checkpoints = 1, color = 'accent', sort_order = 1
WHERE hours = 24;

-- ────────────────────────────────────────────
-- 006_releases.sql
-- ────────────────────────────────────────────
-- App releases table — written by GitHub Actions on each new build
CREATE TABLE IF NOT EXISTS releases (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  version       text        NOT NULL UNIQUE,
  download_url  text        NOT NULL,
  file_name     text        NOT NULL DEFAULT '',
  release_notes text        NOT NULL DEFAULT '',
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read releases"
  ON releases FOR SELECT USING (true);

-- Allow service role to insert/update (GitHub Actions uses service key)
CREATE POLICY "service insert releases"
  ON releases FOR INSERT
  WITH CHECK (true);

CREATE POLICY "service update releases"
  ON releases FOR UPDATE
  USING (true);

-- ────────────────────────────────────────────
-- audit_bans_hwid_resets.sql
-- ────────────────────────────────────────────
-- ── pg_cron: auto-delete expired keys older than 7 days ─────────────────────
-- Run this in Supabase SQL Editor (requires pg_cron extension, enabled by default)
-- SELECT cron.schedule(
--   'delete-old-expired-keys',
--   '0 3 * * *',   -- daily at 3 AM UTC
--   $$
--     DELETE FROM keys
--     WHERE expires_at < now() - INTERVAL '7 days'
--       AND is_disabled = false;
--   $$
-- );

-- ── Self-service HWID reset cooldown column ──────────────────────────────────
ALTER TABLE keys ADD COLUMN IF NOT EXISTS hwid_reset_at timestamptz;

-- ── Audit Log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz DEFAULT now() NOT NULL,
  action      text        NOT NULL,   -- e.g. 'create_key', 'delete_key', 'disable_key'
  target_id   text,                   -- key id or other entity id
  target_key  text,                   -- key_value for quick reference
  details     jsonb,                  -- extra context (hours, reason, etc.)
  admin_email text                    -- which admin did it
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_audit" ON audit_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_insert_audit" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- ── Bans ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bans (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz DEFAULT now() NOT NULL,
  ip_address  text        UNIQUE NOT NULL,
  reason      text,
  banned_until timestamptz,           -- null = permanent
  banned_by   text
);

ALTER TABLE bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_bans" ON bans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── HWID Reset Requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hwid_resets (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz DEFAULT now() NOT NULL,
  key_value   text        NOT NULL,
  reason      text,
  status      text        DEFAULT 'pending' NOT NULL,  -- pending | approved | denied
  resolved_at timestamptz,
  resolved_by text
);

ALTER TABLE hwid_resets ENABLE ROW LEVEL SECURITY;
-- Anyone can insert (submit a request); only admins can read/update
CREATE POLICY "anyone_insert_hwid_resets" ON hwid_resets
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin_read_hwid_resets" ON hwid_resets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_update_hwid_resets" ON hwid_resets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────
-- security_hardening.sql
-- ────────────────────────────────────────────
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

-- ────────────────────────────────────────────
-- 008_security.sql
-- ────────────────────────────────────────────
-- ── Security hardening: roblox_accounts RLS + persistent rate limits ──────────

-- 1. roblox_accounts ─────────────────────────────────────────────────────────
--    Create if not already present (safe to run on existing table too)
CREATE TABLE IF NOT EXISTS roblox_accounts (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  username          text        NOT NULL UNIQUE,
  display_name      text        DEFAULT '',
  password          text        DEFAULT '',
  cookie            text        DEFAULT '',
  robux             bigint      DEFAULT 0,
  added_at          timestamptz,
  cookie_updated_at timestamptz,
  synced_at         timestamptz DEFAULT now()
);

-- Enable RLS — blocks all access that isn't explicitly granted
ALTER TABLE roblox_accounts ENABLE ROW LEVEL SECURITY;

-- Drop any accidentally broad policies that might already exist
DROP POLICY IF EXISTS "anon_read_accounts"   ON roblox_accounts;
DROP POLICY IF EXISTS "public_read_accounts" ON roblox_accounts;
DROP POLICY IF EXISTS "allow_all"            ON roblox_accounts;

-- Desktop app (anon key) may INSERT and UPDATE — but cannot SELECT
CREATE POLICY "anon_insert_accounts"
  ON roblox_accounts FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "anon_update_accounts"
  ON roblox_accounts FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

-- Authenticated admins get full access (admin panel uses a signed-in session)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'roblox_accounts' AND policyname = 'admin_all_accounts'
  ) THEN
    EXECUTE 'CREATE POLICY "admin_all_accounts" ON roblox_accounts
             FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;


-- 2. validate_rate_limits ─────────────────────────────────────────────────────
--    Persistent per-IP attempt tracking for the validate-key edge function.
--    Survives cold starts; replaces the in-memory Map that resets on restart.
CREATE TABLE IF NOT EXISTS validate_rate_limits (
  ip_address    text        PRIMARY KEY,
  attempt_count int         NOT NULL DEFAULT 1,
  window_start  timestamptz NOT NULL DEFAULT now()
);

-- Service role only — the edge function uses the service key
ALTER TABLE validate_rate_limits ENABLE ROW LEVEL SECURITY;


-- 3. Atomic rate-limit increment (avoids race conditions) ────────────────────
--    Returns the attempt count for the current window.
--    If the window has expired (> 60 s), it resets the counter to 1.
CREATE OR REPLACE FUNCTION increment_validate_attempts(p_ip text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as the function owner (service role), bypasses RLS
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO validate_rate_limits (ip_address, attempt_count, window_start)
  VALUES (p_ip, 1, now())
  ON CONFLICT (ip_address) DO UPDATE
    SET
      attempt_count = CASE
        WHEN EXTRACT(EPOCH FROM (now() - validate_rate_limits.window_start)) > 60
          THEN 1
        ELSE validate_rate_limits.attempt_count + 1
      END,
      window_start = CASE
        WHEN EXTRACT(EPOCH FROM (now() - validate_rate_limits.window_start)) > 60
          THEN now()
        ELSE validate_rate_limits.window_start
      END
  RETURNING attempt_count INTO v_count;

  RETURN v_count;
END;
$$;

-- ────────────────────────────────────────────
-- 007_roblox_accounts_timestamps.sql
-- ────────────────────────────────────────────
-- Add timestamp tracking columns to roblox_accounts
ALTER TABLE roblox_accounts
  ADD COLUMN IF NOT EXISTS added_at          timestamptz,
  ADD COLUMN IF NOT EXISTS cookie_updated_at timestamptz;

