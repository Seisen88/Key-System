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
