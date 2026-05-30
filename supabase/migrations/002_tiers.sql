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
