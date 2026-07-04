'use client'

import { useState, useEffect, useCallback } from 'react'
import type { UserRole, ResourceType, PermissionSet } from '@/lib/supabase/types'

// Re-export UserRole pour faciliter l'import
export type { UserRole } from '@/lib/supabase/types'

interface UseUserPermissionsReturn {
  permissions: Record<ResourceType, PermissionSet>
  loading: boolean
  error: string | null
  hasPermission: (resource: ResourceType, action: keyof PermissionSet) => boolean
  refresh: () => Promise<void>
}

// Toutes les permissions à true — pour le super_admin, appliqué IMMÉDIATEMENT
// (son rôle est déjà connu, inutile d'attendre l'API)
const ALL_TRUE_PERMISSIONS: Record<ResourceType, PermissionSet> = {
  agenda: { can_view: true, can_create: true, can_edit: true, can_delete: true },
  orders: { can_view: true, can_create: true, can_edit: true, can_delete: true },
  clients: { can_view: true, can_create: true, can_edit: true, can_delete: true },
  chat: { can_view: true, can_create: true, can_edit: true, can_delete: true },
  calls: { can_view: true, can_create: true, can_edit: true, can_delete: true },
  users: { can_view: true, can_create: true, can_edit: true, can_delete: true },
  logs: { can_view: true, can_create: true, can_edit: true, can_delete: true },
  settings: { can_view: true, can_create: true, can_edit: true, can_delete: true },
  permissions: { can_view: true, can_create: true, can_edit: true, can_delete: true },
  messenger: { can_view: true, can_create: true, can_edit: true, can_delete: true },
  chat_stats: { can_view: true, can_create: true, can_edit: true, can_delete: true },
}

// Cache localStorage des permissions par rôle — évite la fenêtre morte au
// chargement où TOUT était "interdit" par défaut pendant l'appel API
// (~300-800 ms) : les clics sur l'agenda étaient silencieusement ignorés.
const PERMS_CACHE_KEY = 'admin_perms_cache_v1'
const PERMS_TTL_MS = 24 * 60 * 60 * 1000

function readPermsCache(role: string): Record<ResourceType, PermissionSet> | null {
  try {
    const raw = localStorage.getItem(PERMS_CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as { role: string; ts: number; perms: Record<ResourceType, PermissionSet> }
    if (entry.role !== role) return null
    if (Date.now() - entry.ts > PERMS_TTL_MS) return null
    return entry.perms
  } catch {
    return null
  }
}

function writePermsCache(role: string, perms: Record<ResourceType, PermissionSet>): void {
  try {
    localStorage.setItem(PERMS_CACHE_KEY, JSON.stringify({ role, ts: Date.now(), perms }))
  } catch {
    // non bloquant
  }
}

const DEFAULT_PERMISSIONS: Record<ResourceType, PermissionSet> = {
  agenda: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  orders: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  clients: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  chat: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  calls: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  users: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  logs: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  settings: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  permissions: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  messenger: { can_view: false, can_create: false, can_edit: false, can_delete: false },
  chat_stats: { can_view: false, can_create: false, can_edit: false, can_delete: false },
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

    // Démarrage INSTANTANÉ — plus de "fenêtre morte" où tous les clics étaient
    // ignorés pendant l'appel API :
    // - super_admin : tous les droits d'office (le rôle est déjà connu)
    // - autres rôles : cache local du dernier chargement s'il existe
    // L'appel API continue ensuite et met à jour/rafraîchit le cache.
    if (userRole === 'super_admin') {
      setPermissions(ALL_TRUE_PERMISSIONS)
      setLoading(false)
    } else {
      const cached = readPermsCache(userRole)
      if (cached) {
        setPermissions(cached)
        setLoading(false)
      } else {
        setLoading(true)
      }
    }
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
      // Mémoriser pour un démarrage instantané au prochain chargement
      writePermsCache(userRole, userPerms)
    } catch (err) {
      console.error('Error fetching user permissions:', err)
      setError('Erreur lors du chargement des permissions')
      // En cas d'erreur, on garde les permissions par défaut (tout à false sauf pour super_admin)
      if (userRole === 'super_admin') {
        // Super admin a toujours tous les droits
        setPermissions(ALL_TRUE_PERMISSIONS)
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
