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
