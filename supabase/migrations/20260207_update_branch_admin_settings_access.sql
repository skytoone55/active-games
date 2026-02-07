-- Migration: Give branch_admin access to Settings page
-- Date: 2026-02-07
-- Description: Allow branch_admin to view, create, and edit settings (but not delete)

UPDATE role_permissions
SET can_view = true, can_create = true, can_edit = true
WHERE role = 'branch_admin' AND resource = 'settings';
