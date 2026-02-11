'use client'

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useRealtimeRefresh } from './useRealtimeSubscription'
import { swrFetcher } from '@/lib/swr-fetcher'
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
  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; permissions: RolePermission[] }>(
    '/api/permissions',
    swrFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  const permissions = data?.permissions || []

  // Organize permissions by role - memoized to avoid recomputation
  const permissionsByRole = useMemo(() => {
    const byRole: Record<UserRole, PermissionsByResource> = {} as Record<UserRole, PermissionsByResource>

    if (permissions.length === 0) return byRole

    // Extract unique roles from permissions data (supports dynamic roles)
    const uniqueRoles = [...new Set(permissions.map((p: RolePermission) => p.role))] as UserRole[]

    for (const role of uniqueRoles) {
      byRole[role] = {} as PermissionsByResource
      for (const resource of RESOURCE_ORDER) {
        const perm = permissions.find((p: RolePermission) => p.role === role && p.resource === resource)
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

    return byRole
  }, [permissions])

  // Realtime updates for permissions - trigger SWR revalidation
  const handleRealtimeRefresh = useCallback(() => {
    mutate()
  }, [mutate])

  useRealtimeRefresh('role_permissions', null, handleRealtimeRefresh)

  // Update a single permission
  const updatePermission = useCallback(async (
    rolePermissionId: string,
    updates: Partial<PermissionSet>
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rolePermissionId, ...updates })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to update permission')
      }

      await mutate()
      return true
    } catch (err) {
      console.error('Error updating permission:', err)
      return false
    }
  }, [mutate])

  // Save multiple permissions at once (batch save)
  const savePermissions = useCallback(async (
    changes: Array<{ id: string; updates: Partial<PermissionSet> }>
  ): Promise<boolean> => {
    try {
      // Process all changes sequentially
      for (const change of changes) {
        const response = await fetch('/api/permissions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: change.id, ...change.updates })
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to update permission')
        }
      }

      await mutate()
      return true
    } catch (err) {
      console.error('Error saving permissions:', err)
      return false
    }
  }, [mutate])

  return {
    permissions,
    loading: isLoading,
    error: error ? 'Erreur lors du chargement des permissions' : null,
    permissionsByRole,
    updatePermission,
    savePermissions,
    refresh: async () => { await mutate() }
  }
}

// Export constants for use in components
export { RESOURCE_ORDER }
