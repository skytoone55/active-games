'use client'

import { createContext, useContext, useCallback, useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { useAuth, type AuthUser } from '@/hooks/useAuth'
import { useBranches, type BranchWithDetails } from '@/hooks/useBranches'

interface AdminContextValue {
  // Auth
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  // Branches
  branches: BranchWithDetails[]
  selectedBranch: BranchWithDetails | null
  selectedBranchId: string | null
  selectBranch: (branchId: string) => void
  refreshBranches: () => Promise<void>
  branchesLoading: boolean
  // Theme
  theme: 'light' | 'dark'
  toggleTheme: () => void
  isDark: boolean
}

const AdminContext = createContext<AdminContextValue | null>(null)

export function AdminProvider({ children, theme, toggleTheme }: {
  children: React.ReactNode
  theme: 'light' | 'dark'
  toggleTheme: () => void
}) {
  const { user, loading: authLoading, signOut, refreshUser } = useAuth()

  // Passer les données d'auth à useBranches pour éviter un getUser() + profiles redondant
  // IMPORTANT: useMemo pour éviter de recréer l'objet à chaque render (sinon boucle infinie dans useBranches)
  const authUserData = useMemo(() =>
    user ? { id: user.id, role: user.role, branches: user.branches.map(b => ({ id: b.id })) } : null,
    [user?.id, user?.role, user?.branches]
  )
  const { branches, selectedBranch, selectedBranchId, selectBranch, loading: branchesLoading, refresh: refreshBranches } = useBranches(authUserData)

  // Clara Codex human-presence heartbeat (no-op for super admin)
  useEffect(() => {
    if (!user || user.role === 'super_admin') return

    let isMounted = true
    let interval: NodeJS.Timeout | null = null

    const sendHeartbeat = async () => {
      if (!isMounted) return
      try {
        await fetch('/api/admin/clara-codex/presence', { method: 'POST' })
      } catch {
        // Non-blocking
      }
    }

    void sendHeartbeat()
    interval = setInterval(sendHeartbeat, 45 * 1000)

    return () => {
      isMounted = false
      if (interval) clearInterval(interval)
    }
  }, [user?.id, user?.role])

  const value: AdminContextValue = {
    user,
    loading: authLoading, // Only block on auth, not branches — pages can render while branches load
    signOut,
    refreshUser,
    branches,
    selectedBranch,
    selectedBranchId,
    selectBranch,
    refreshBranches,
    branchesLoading,
    theme,
    toggleTheme,
    isDark: theme === 'dark',
  }

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext)
  if (!ctx) {
    throw new Error('useAdmin must be used within AdminProvider')
  }
  return ctx
}
