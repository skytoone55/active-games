-- Migration: Remove hardcoded role check constraint to allow dynamic roles
-- Date: 2026-01-20
-- Description: The role_permissions table had a CHECK constraint limiting roles to
--              'super_admin', 'branch_admin', 'agent'. This prevents creating permissions
--              for dynamically created roles. We replace it with a foreign key to the roles table.

-- 1. Drop the old CHECK constraint (the name might vary, so we drop all check constraints on 'role' column)
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_check;

-- 2. Verify the role_id foreign key exists (it should reference roles.id)
-- If it doesn't exist, add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'role_permissions_role_id_fkey'
    AND table_name = 'role_permissions'
  ) THEN
    ALTER TABLE role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Add a trigger to ensure role column matches the role name from roles table
CREATE OR REPLACE FUNCTION sync_role_permission_role_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If role_id is set, sync the role name from the roles table
  IF NEW.role_id IS NOT NULL THEN
    SELECT name INTO NEW.role FROM roles WHERE id = NEW.role_id;
    IF NEW.role IS NULL THEN
      RAISE EXCEPTION 'Role with id % not found', NEW.role_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_sync_role_permission_role_name ON role_permissions;
CREATE TRIGGER trg_sync_role_permission_role_name
  BEFORE INSERT OR UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION sync_role_permission_role_name();
