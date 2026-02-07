-- Migration: Add messenger permissions to role_permissions
-- Date: 2026-02-07
-- Description: Add messenger resource with permissions for all roles

-- Step 1: Drop existing constraint
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_resource_check;

-- Step 2: Add new constraint with messenger included
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_resource_check
CHECK (resource IN ('agenda', 'orders', 'clients', 'users', 'logs', 'settings', 'permissions', 'calls', 'messenger'));

-- Step 3: Insert messenger permissions for super_admin
INSERT INTO role_permissions (role, resource, can_view, can_create, can_edit, can_delete)
VALUES ('super_admin', 'messenger', true, true, true, true)
ON CONFLICT (role, resource) DO UPDATE
SET can_view = true, can_create = true, can_edit = true, can_delete = true;

-- Step 4: Insert messenger permissions for branch_admin
INSERT INTO role_permissions (role, resource, can_view, can_create, can_edit, can_delete)
VALUES ('branch_admin', 'messenger', true, true, true, false)
ON CONFLICT (role, resource) DO UPDATE
SET can_view = true, can_create = true, can_edit = true, can_delete = false;

-- Step 5: Insert messenger permissions for agent
INSERT INTO role_permissions (role, resource, can_view, can_create, can_edit, can_delete)
VALUES ('agent', 'messenger', true, false, false, false)
ON CONFLICT (role, resource) DO UPDATE
SET can_view = true, can_create = false, can_edit = false, can_delete = false;
