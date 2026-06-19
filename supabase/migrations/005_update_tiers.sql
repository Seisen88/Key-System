-- Remove old 6h and 12h tiers, update 24h, add 48h
DELETE FROM tiers WHERE hours IN (6, 12);

INSERT INTO tiers (hours, label, checkpoints, color, sort_order)
VALUES (48, '48 Hours', 2, 'purple', 2)
ON CONFLICT (hours) DO NOTHING;

UPDATE tiers SET label = '24 Hours', checkpoints = 1, color = 'accent', sort_order = 1
WHERE hours = 24;
