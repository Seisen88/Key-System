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
