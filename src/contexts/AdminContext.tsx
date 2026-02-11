'use client'

import { createContext, useContext, useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import { useAuth, type AuthUser } from '@/hooks/useAuth'
import { useBranches } from '@/hooks/useBranches'
import type { Branch } from '@/lib/supabase/types'

interface AdminContextValue {
  // Auth
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  // Branches
  branches: Branch[]
  selectedBranch: Branch | null
  selectedBranchId: string | null
  selectBranch: (branchId: string) => void
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
  const { branches, selectedBranch, selectedBranchId, selectBranch, loading: branchesLoading } = useBranches()

  const value: AdminContextValue = {
    user,
    loading: authLoading || branchesLoading,
    signOut,
    refreshUser,
    branches,
    selectedBranch,
    selectedBranchId,
    selectBranch,
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
