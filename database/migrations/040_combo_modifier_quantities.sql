BEGIN;
ALTER TABLE sf_modifier_groups
  ADD COLUMN IF NOT EXISTS selection_mode text NOT NULL DEFAULT 'unique';
ALTER TABLE sf_modifier_groups
  DROP CONSTRAINT IF EXISTS sf_modifier_groups_selection_mode_check;
ALTER TABLE sf_modifier_groups
  ADD CONSTRAINT sf_modifier_groups_selection_mode_check
  CHECK (selection_mode IN ('unique', 'bundle'));
COMMIT;
