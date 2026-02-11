'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import type { Role } from '@/lib/supabase/types'
import { swrFetcher } from '@/lib/swr-fetcher'

const FALLBACK_ROLES: Role[] = [
  { id: 'default-super-admin', name: 'super_admin', display_name: 'Super Admin', description: 'Full access to all features', level: 1, color: '#EF4444', icon: 'Shield', is_system: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'default-branch-admin', name: 'branch_admin', display_name: 'Branch Admin', description: 'Branch administration', level: 5, color: '#8B5CF6', icon: 'UserCog', is_system: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'default-agent', name: 'agent', display_name: 'Agent', description: 'Agent with limited access', level: 8, color: '#3B82F6', icon: 'Users', is_system: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
]

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

export function useRoles(): UseRolesReturn {
  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; roles: Role[] }>(
    '/api/roles',
    swrFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  const roles = data?.roles
    ? [...data.roles].sort((a: Role, b: Role) => a.level - b.level)
    : (error ? FALLBACK_ROLES : [])

  const getRoleById = useCallback((id: string) => roles.find(r => r.id === id), [roles])
  const getRoleByName = useCallback((name: string) => roles.find(r => r.name === name), [roles])
  const getRoleLevel = useCallback((roleNameOrId: string) => {
    const role = roles.find(r => r.id === roleNameOrId || r.name === roleNameOrId)
    return role?.level ?? 10
  }, [roles])
  const canManageRole = useCallback((userLevel: number, targetLevel: number) => userLevel < targetLevel, [])
  const getManageableRoles = useCallback((userLevel: number) => roles.filter(r => !r.is_system && r.level > userLevel), [roles])
  const getAssignableRoles = useCallback((userLevel: number) => roles.filter(r => r.level > userLevel), [roles])
  const isSystemRole = useCallback((roleNameOrId: string) => {
    const role = roles.find(r => r.id === roleNameOrId || r.name === roleNameOrId)
    return role?.is_system ?? false
  }, [roles])

  return {
    roles,
    loading: isLoading,
    error: error ? 'Erreur lors du chargement des rôles' : null,
    getRoleById, getRoleByName, getRoleLevel, canManageRole,
    getManageableRoles, getAssignableRoles, isSystemRole,
    refresh: async () => { await mutate() }
  }
}

export function useUserRoleLevel(userRole: string | null): number {
  const { getRoleLevel } = useRoles()
  if (!userRole) return 10
  return getRoleLevel(userRole)
}
