'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Role } from '@/lib/supabase/types'

interface UseRolesReturn {
  roles: Role[]
  loading: boolean
  error: string | null
  getRoleById: (id: string) => Role | undefined
  getRoleByName: (name: string) => Role | undefined
  getRoleLevel: (roleNameOrId: string) => number
  canManageRole: (userLevel: number, targetLevel: number) => boolean
  getManageableRoles: (userLevel: number) => Role[]
  getAssignableRoles: (userLevel: number) => Role[]
  isSystemRole: (roleNameOrId: string) => boolean
  refresh: () => Promise<void>
}

/**
 * Hook pour gérer les rôles dynamiques avec hiérarchie
 *
 * Règles de hiérarchie:
 * - Level 1 = autorité maximale (super_admin)
 * - Level 10 = autorité minimale
 * - Un utilisateur peut gérer les rôles avec level > son level
 * - Un utilisateur peut assigner des rôles avec level > son level
 * - Les rôles is_system=true ne peuvent pas être modifiés/supprimés
 */
export function useRoles(): UseRolesReturn {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/roles')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch roles')
      }

      // Les rôles sont triés par level (1 en premier = plus haute autorité)
      const sortedRoles = (data.roles || []).sort((a: Role, b: Role) => a.level - b.level)
      setRoles(sortedRoles)
    } catch (err) {
      console.error('Error fetching roles:', err)
      setError('Erreur lors du chargement des rôles')

      // Fallback avec les rôles par défaut en cas d'erreur
      setRoles([
        {
          id: 'default-super-admin',
          name: 'super_admin',
          display_name: 'Super Admin',
          description: 'Full access to all features',
          level: 1,
          color: '#EF4444',
          icon: 'Shield',
          is_system: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'default-branch-admin',
          name: 'branch_admin',
          display_name: 'Branch Admin',
          description: 'Branch administration',
          level: 5,
          color: '#8B5CF6',
          icon: 'UserCog',
          is_system: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'default-agent',
          name: 'agent',
          display_name: 'Agent',
          description: 'Agent with limited access',
          level: 8,
          color: '#3B82F6',
          icon: 'Users',
          is_system: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  /**
   * Obtenir un rôle par son ID
   */
  const getRoleById = useCallback((id: string): Role | undefined => {
    return roles.find(r => r.id === id)
  }, [roles])

  /**
   * Obtenir un rôle par son nom (slug)
   */
  const getRoleByName = useCallback((name: string): Role | undefined => {
    return roles.find(r => r.name === name)
  }, [roles])

  /**
   * Obtenir le niveau d'un rôle par son nom ou ID
   * Retourne 10 (niveau le plus bas) si non trouvé
   */
  const getRoleLevel = useCallback((roleNameOrId: string): number => {
    const role = roles.find(r => r.id === roleNameOrId || r.name === roleNameOrId)
    return role?.level ?? 10
  }, [roles])

  /**
   * Vérifier si un utilisateur peut gérer un rôle
   * Un utilisateur peut gérer les rôles avec level > son level
   */
  const canManageRole = useCallback((userLevel: number, targetLevel: number): boolean => {
    // Level plus bas = plus d'autorité
    // userLevel < targetLevel signifie que l'utilisateur a plus d'autorité
    return userLevel < targetLevel
  }, [])

  /**
   * Obtenir les rôles qu'un utilisateur peut modifier/supprimer
   * Exclut les rôles système et les rôles avec level <= userLevel
   */
  const getManageableRoles = useCallback((userLevel: number): Role[] => {
    return roles.filter(r => !r.is_system && r.level > userLevel)
  }, [roles])

  /**
   * Obtenir les rôles qu'un utilisateur peut assigner à d'autres utilisateurs
   * Inclut tous les rôles avec level > userLevel (même les rôles système comme super_admin ne peuvent pas être assignés par d'autres)
   */
  const getAssignableRoles = useCallback((userLevel: number): Role[] => {
    return roles.filter(r => r.level > userLevel)
  }, [roles])

  /**
   * Vérifier si un rôle est un rôle système (non modifiable/supprimable)
   */
  const isSystemRole = useCallback((roleNameOrId: string): boolean => {
    const role = roles.find(r => r.id === roleNameOrId || r.name === roleNameOrId)
    return role?.is_system ?? false
  }, [roles])

  return {
    roles,
    loading,
    error,
    getRoleById,
    getRoleByName,
    getRoleLevel,
    canManageRole,
    getManageableRoles,
    getAssignableRoles,
    isSystemRole,
    refresh: fetchRoles
  }
}

/**
 * Hook simplifié pour obtenir le niveau du rôle de l'utilisateur connecté
 */
export function useUserRoleLevel(userRole: string | null): number {
  const { getRoleLevel } = useRoles()

  if (!userRole) return 10 // Niveau le plus bas par défaut
  return getRoleLevel(userRole)
}
