-- Migration: Add chat_stats resource permission
-- This allows independent permission control for the Chat Statistics tab

-- Step 1: Update constraint to include chat_stats
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_resource_check;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_resource_check
CHECK (resource IN ('agenda', 'orders', 'clients', 'users', 'logs', 'settings', 'permissions', 'calls', 'messenger', 'chat', 'chat_stats'));

-- Step 2: Insert chat_stats permissions for all existing roles
-- super_admin and branch_admin get view access, others don't
INSERT INTO role_permissions (role, role_id, resource, can_view, can_create, can_edit, can_delete)
SELECT rp.role, rp.role_id, 'chat_stats',
  CASE WHEN rp.role IN ('super_admin', 'branch_admin') THEN true ELSE false END,
  false, false, false
FROM role_permissions rp
WHERE rp.resource = 'agenda'
ON CONFLICT (role, resource) DO NOTHING;
