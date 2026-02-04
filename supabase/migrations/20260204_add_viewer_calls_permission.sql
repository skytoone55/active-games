-- Migration: Add missing calls permission for viewer role
-- Date: 2026-02-04
-- Description: The viewer role was missing from the initial calls permissions migration.
--              This adds the permission for viewer to view calls (read-only access).

-- Add calls permission for viewer role
INSERT INTO public.role_permissions (role, resource, can_view, can_create, can_edit, can_delete)
VALUES
  ('viewer', 'calls', true, false, false, false)
ON CONFLICT (role, resource) DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete;
