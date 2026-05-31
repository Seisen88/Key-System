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
