'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile, Branch, UserRole, ProfileInsert } from '@/lib/supabase/types'

export interface AuthUser {
  id: string
  email: string
  profile: Profile | null
  branches: Branch[]
  role: UserRole | null
  isSuperAdmin: boolean
  isBranchAdmin: boolean
  isAgent: boolean
}

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUserData = useCallback(async (authUser: User) => {
    const supabase = getClient()

    try {
      // Récupérer le profil
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single<Profile>()

      // Si le profil n'existe pas (code PGRST116 = no rows), le créer
      if (profileError && profileError.code === 'PGRST116') {
        const userName = authUser.email?.split('@')[0] || 'Admin'
        const profileData: ProfileInsert = {
          id: authUser.id,
          role: 'super_admin', // Premier utilisateur = super_admin
          first_name: userName,
          last_name: '',
          phone: '0500000000', // Placeholder phone - super admin should update later
          full_name: userName,
        }
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          // @ts-expect-error - Supabase SSR typing limitation with insert
          .insert(profileData)
          .select()
          .single<Profile>()

        if (createError) {
          throw createError
        }
        profile = newProfile
        profileError = null
      } else if (profileError) {
        throw profileError
      }

      // Récupérer les branches autorisées
      let branches: Branch[] = []

      if (profile?.role === 'super_admin') {
        // Super admin voit toutes les branches
        const { data: allBranches } = await supabase
          .from('branches')
          .select('*')
          .eq('is_active', true)
          .order('name')
          .returns<Branch[]>()

        branches = allBranches || []
      } else {
        // Autres utilisateurs voient leurs branches
        const { data: userBranches } = await supabase
          .from('user_branches')
          .select('branch_id')
          .eq('user_id', authUser.id)
          .returns<Array<{ branch_id: string }>>()

        if (userBranches && userBranches.length > 0) {
          const branchIds = userBranches.map(ub => ub.branch_id)
          const { data: authorizedBranches } = await supabase
            .from('branches')
            .select('*')
            .in('id', branchIds)
            .eq('is_active', true)
            .order('name')
            .returns<Branch[]>()

          branches = authorizedBranches || []
        }
      }

      const role = profile?.role || null

      setUser({
        id: authUser.id,
        email: authUser.email || '',
        profile: profile || null,
        branches,
        role,
        isSuperAdmin: role === 'super_admin',
        isBranchAdmin: role === 'branch_admin',
        isAgent: role === 'agent',
      })
    } catch (err) {
      console.error('Error fetching user data:', err)
      setError('Erreur lors du chargement des données utilisateur')
    }
  }, [])

  useEffect(() => {
    const supabase = getClient()

    // Vérifier la session actuelle
    const checkSession = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (authUser) {
          await fetchUserData(authUser)
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('Error checking session:', err)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchUserData(session.user)
          // Logger la connexion
          try {
            await fetch('/api/auth/log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'login' })
            })
          } catch (e) {
            console.error('Failed to log login:', e)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchUserData])

  const signOut = useCallback(async () => {
    const supabase = getClient()
    // Logger la déconnexion AVANT de se déconnecter (sinon plus de session)
    try {
      await fetch('/api/auth/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      })
    } catch (e) {
      console.error('Failed to log logout:', e)
    }
    await supabase.auth.signOut()
    setUser(null)
    router.push('/admin/login')
  }, [router])

  const refreshUser = useCallback(async () => {
    const supabase = getClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      await fetchUserData(authUser)
    }
  }, [fetchUserData])

  return {
    user,
    loading,
    error,
    signOut,
    refreshUser,
    isAuthenticated: !!user,
  }
}
