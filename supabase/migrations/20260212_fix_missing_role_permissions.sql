-- Fix: ensure ALL roles have ALL resources in role_permissions
-- Previously, new resources (chat, calls, messenger, chat_stats) were missing
-- from roles created before those features existed.

-- Insert missing permissions for any role that doesn't have all resources
INSERT INTO role_permissions (role, role_id, resource, can_view, can_create, can_edit, can_delete)
SELECT r.name, r.id, res.resource, false, false, false, false
FROM roles r
CROSS JOIN (
  SELECT unnest(ARRAY['agenda','orders','chat','clients','calls','users','logs','settings','permissions','messenger','chat_stats']) AS resource
) res
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.role = r.name AND rp.resource = res.resource
)
ON CONFLICT DO NOTHING;
