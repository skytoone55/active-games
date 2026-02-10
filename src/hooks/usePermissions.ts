'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRealtimeRefresh } from './useRealtimeSubscription'
import type { RolePermission, UserRole, ResourceType, PermissionSet, PermissionsByResource } from '@/lib/supabase/types'

interface UsePermissionsReturn {
  permissions: RolePermission[]
  loading: boolean
  error: string | null
  permissionsByRole: Record<UserRole, PermissionsByResource>
  updatePermission: (rolePermissionId: string, updates: Partial<PermissionSet>) => Promise<boolean>
  savePermissions: (changes: Array<{ id: string; updates: Partial<PermissionSet> }>) => Promise<boolean>
  refresh: () => Promise<void>
}

// Resource display order
const RESOURCE_ORDER: ResourceType[] = ['agenda', 'orders', 'chat', 'clients', 'calls', 'users', 'logs', 'settings', 'permissions', 'messenger']

export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [permissionsByRole, setPermissionsByRole] = useState<Record<UserRole, PermissionsByResource>>({} as Record<UserRole, PermissionsByResource>)

  const fetchPermissions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/permissions')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch permissions')
      }

      const perms = data.permissions || []
      setPermissions(perms)

      // Organize permissions by role - dynamically from the permissions data
      const byRole: Record<UserRole, PermissionsByResource> = {} as Record<UserRole, PermissionsByResource>

      // Extract unique roles from permissions data (supports dynamic roles)
      const uniqueRoles = [...new Set(perms.map((p: RolePermission) => p.role))] as UserRole[]

      for (const role of uniqueRoles) {
        byRole[role] = {} as PermissionsByResource
        for (const resource of RESOURCE_ORDER) {
          const perm = perms.find((p: RolePermission) => p.role === role && p.resource === resource)
          byRole[role][resource] = perm ? {
            can_view: perm.can_view,
            can_create: perm.can_create,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete
          } : {
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false
          }
        }
      }

      setPermissionsByRole(byRole)
    } catch (err) {
      console.error('Error fetching permissions:', err)
      setError('Erreur lors du chargement des permissions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  // Realtime updates for permissions
  useRealtimeRefresh('role_permissions', null, fetchPermissions)

  // Update a single permission
  const updatePermission = useCallback(async (
    rolePermissionId: string,
    updates: Partial<PermissionSet>
  ): Promise<boolean> => {
    setError(null)
    try {
      const response = await fetch('/api/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rolePermissionId, ...updates })
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to update permission')
      }

      await fetchPermissions()
      return true
    } catch (err) {
      console.error('Error updating permission:', err)
      setError('Erreur lors de la mise à jour de la permission')
      return false
    }
  }, [fetchPermissions])

  // Save multiple permissions at once (batch save)
  const savePermissions = useCallback(async (
    changes: Array<{ id: string; updates: Partial<PermissionSet> }>
  ): Promise<boolean> => {
    setError(null)
    try {
      // Process all changes sequentially
      for (const change of changes) {
        const response = await fetch('/api/permissions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: change.id, ...change.updates })
        })

        const data = await response.json()
        if (!data.success) {
          throw new Error(data.error || 'Failed to update permission')
        }
      }

      await fetchPermissions()
      return true
    } catch (err) {
      console.error('Error saving permissions:', err)
      setError('Erreur lors de l\'enregistrement des permissions')
      return false
    }
  }, [fetchPermissions])

  return {
    permissions,
    loading,
    error,
    permissionsByRole,
    updatePermission,
    savePermissions,
    refresh: fetchPermissions
  }
}

// Export constants for use in components
export { RESOURCE_ORDER }
