-- Add timestamp tracking columns to roblox_accounts
ALTER TABLE roblox_accounts
  ADD COLUMN IF NOT EXISTS added_at          timestamptz,
  ADD COLUMN IF NOT EXISTS cookie_updated_at timestamptz;
