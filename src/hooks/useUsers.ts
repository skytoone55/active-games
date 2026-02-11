import { useCallback } from 'react'
import useSWR from 'swr'
import type { UserWithBranches } from '@/lib/supabase/types'
import { swrFetcher } from '@/lib/swr-fetcher'

interface CreateUserData {
  email: string
  first_name: string
  last_name: string
  phone: string
  role_id: string
  branch_ids: string[]
  password?: string
}

interface UpdateUserData {
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  password?: string
  role_id?: string
  branch_ids?: string[]
}

export function useUsers() {
  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; users: UserWithBranches[] }>(
    '/api/admin/users',
    swrFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const users = data?.users || []

  const createUser = useCallback(async (userData: CreateUserData): Promise<{ success: boolean; user?: UserWithBranches; temporaryPassword?: string; error?: string }> => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })
      const result = await response.json()
      if (result.success) {
        await mutate()
        return { success: true, user: result.user, temporaryPassword: result.temporaryPassword }
      } else {
        return { success: false, error: result.error }
      }
    } catch (err) {
      console.error('Error creating user:', err)
      return { success: false, error: 'Erreur de connexion' }
    }
  }, [mutate])

  const updateUser = useCallback(async (userId: string, updates: UpdateUserData): Promise<{ success: boolean; user?: UserWithBranches; error?: string }> => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const result = await response.json()
      if (result.success) {
        await mutate()
        return { success: true, user: result.user }
      } else {
        return { success: false, error: result.error }
      }
    } catch (err) {
      console.error('Error updating user:', err)
      return { success: false, error: 'Erreur de connexion' }
    }
  }, [mutate])

  const deleteUser = useCallback(async (userId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      const result = await response.json()
      if (result.success) {
        await mutate()
        return { success: true }
      } else {
        return { success: false, error: result.error }
      }
    } catch (err) {
      console.error('Error deleting user:', err)
      return { success: false, error: 'Erreur de connexion' }
    }
  }, [mutate])

  return {
    users,
    loading: isLoading,
    error: error ? 'Erreur de connexion' : null,
    fetchUsers: () => mutate(),
    createUser,
    updateUser,
    deleteUser,
  }
}
