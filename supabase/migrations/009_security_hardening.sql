-- ── Security hardening: remove direct anon write access ──────────────────────

-- 1. roblox_accounts: drop anon INSERT/UPDATE — writes now go through the
--    sync-account edge function which requires APP_SYNC_SECRET in the header.
DROP POLICY IF EXISTS "anon_insert_accounts" ON roblox_accounts;
DROP POLICY IF EXISTS "anon_update_accounts" ON roblox_accounts;
-- admin_all_accounts (authenticated) stays in place.

-- 2. hwid_resets: track submitter IP for rate limiting, then add a function
--    that enforces max 3 pending requests per IP per 24 h.
ALTER TABLE hwid_resets ADD COLUMN IF NOT EXISTS submitted_ip text DEFAULT '';

-- Drop the unlimited anon insert and replace it with a rate-limited version.
DROP POLICY IF EXISTS "anyone_insert_hwid_resets" ON hwid_resets;

-- Rate-limit function: allow insert only if the IP hasn't submitted 3+
-- pending requests in the last 24 hours.
CREATE OR REPLACE FUNCTION check_hwid_reset_rate_limit(p_ip text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM hwid_resets
  WHERE submitted_ip = p_ip
    AND status = 'pending'
    AND created_at > now() - INTERVAL '24 hours';
  RETURN v_count < 3;
END;
$$;

-- New policy: anon/authenticated can only insert if under the rate limit.
-- submitted_ip must equal the request IP (enforced by the app sending it).
CREATE POLICY "rate_limited_insert_hwid_resets"
  ON hwid_resets FOR INSERT TO anon, authenticated
  WITH CHECK (check_hwid_reset_rate_limit(submitted_ip));

-- 3. Indexes for performance on commonly-queried columns.
CREATE INDEX IF NOT EXISTS idx_keys_expires_at    ON keys       (expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_created  ON audit_log  (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bans_created       ON bans       (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hwid_resets_ip     ON hwid_resets (submitted_ip, status, created_at);
