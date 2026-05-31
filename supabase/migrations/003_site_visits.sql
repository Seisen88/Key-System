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
