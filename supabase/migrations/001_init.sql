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
