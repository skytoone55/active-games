'use client'

import { useState, useEffect, useCallback } from 'react'
import type { UserRole, ResourceType, PermissionSet } from '@/lib/supabase/types'

interface UseUserPermissionsReturn {
  permissions: Record<ResourceType, PermissionSet>
  loading: boolean
  error: string | null
  hasPermission: (resource: ResourceType, action: keyof PermissionSet) => boolean
  refresh: () => Promise<void>
}

const DEFAULT_PERMISSIONS: Record<ResourceType, PermissionSet> = {
  agenda: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  orders: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  clients: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  users: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  logs: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  settings: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  permissions: { can_view: false, can_create: false, can_edit: false, can_delete: false },
}

/**
 * Hook pour récupérer les permissions de l'utilisateur connecté
 * basé sur son rôle. Utilisé pour cacher/afficher les éléments UI.
 */
export function useUserPermissions(userRole: UserRole | null): UseUserPermissionsReturn {
  const [permissions, setPermissions] = useState<Record<ResourceType, PermissionSet>>(DEFAULT_PERMISSIONS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPermissions = useCallback(async () => {
    if (!userRole) {
      setPermissions(DEFAULT_PERMISSIONS)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/permissions')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch permissions')
      }

      const perms = data.permissions || []

      // Filtrer les permissions pour le rôle de l'utilisateur
      const userPerms: Record<ResourceType, PermissionSet> = { ...DEFAULT_PERMISSIONS }

      for (const perm of perms) {
        if (perm.role === userRole) {
          userPerms[perm.resource as ResourceType] = {
            can_view: perm.can_view,
            can_create: perm.can_create,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete
          }
        }
      }

      setPermissions(userPerms)
    } catch (err) {
      console.error('Error fetching user permissions:', err)
      setError('Erreur lors du chargement des permissions')
      // En cas d'erreur, on garde les permissions par défaut (tout à false sauf pour super_admin)
      if (userRole === 'super_admin') {
        // Super admin a toujours tous les droits
        const superAdminPerms: Record<ResourceType, PermissionSet> = {
          agenda: { can_view: true, can_create: true, can_edit: true, can_delete: true },
          orders: { can_view: true, can_create: true, can_edit: true, can_delete: true },
          clients: { can_view: true, can_create: true, can_edit: true, can_delete: true },
          users: { can_view: true, can_create: true, can_edit: true, can_delete: true },
          logs: { can_view: true, can_create: true, can_edit: true, can_delete: true },
          settings: { can_view: true, can_create: true, can_edit: true, can_delete: true },
          permissions: { can_view: true, can_create: true, can_edit: true, can_delete: true },
        }
        setPermissions(superAdminPerms)
      }
    } finally {
      setLoading(false)
    }
  }, [userRole])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  /**
   * Vérifie si l'utilisateur a une permission spécifique
   */
  const hasPermission = useCallback((resource: ResourceType, action: keyof PermissionSet): boolean => {
    return permissions[resource]?.[action] || false
  }, [permissions])

  return {
    permissions,
    loading,
    error,
    hasPermission,
    refresh: fetchPermissions
  }
}
