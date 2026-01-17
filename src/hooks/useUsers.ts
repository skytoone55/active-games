import { useState, useEffect, useCallback } from 'react'
import type { UserWithBranches, UserRole } from '@/lib/supabase/types'

interface CreateUserData {
  email: string
  first_name: string
  last_name: string
  phone: string
  role: UserRole
  branch_ids: string[]
  password?: string
}

interface UpdateUserData {
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  password?: string
  role?: UserRole
  branch_ids?: string[]
}

export function useUsers() {
  const [users, setUsers] = useState<UserWithBranches[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Charger les utilisateurs
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()

      if (data.success) {
        setUsers(data.users)
      } else {
        setError(data.error || 'Erreur lors du chargement')
      }
    } catch (err) {
      console.error('Error fetching users:', err)
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }, [])

  // Créer un utilisateur
  const createUser = useCallback(async (userData: CreateUserData): Promise<{ success: boolean; user?: UserWithBranches; temporaryPassword?: string; error?: string }> => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const data = await response.json()

      if (data.success) {
        // Rafraîchir la liste
        await fetchUsers()
        return { success: true, user: data.user, temporaryPassword: data.temporaryPassword }
      } else {
        return { success: false, error: data.error }
      }
    } catch (err) {
      console.error('Error creating user:', err)
      return { success: false, error: 'Erreur de connexion' }
    }
  }, [fetchUsers])

  // Mettre à jour un utilisateur
  const updateUser = useCallback(async (userId: string, updates: UpdateUserData): Promise<{ success: boolean; user?: UserWithBranches; error?: string }> => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      if (data.success) {
        // Rafraîchir la liste
        await fetchUsers()
        return { success: true, user: data.user }
      } else {
        return { success: false, error: data.error }
      }
    } catch (err) {
      console.error('Error updating user:', err)
      return { success: false, error: 'Erreur de connexion' }
    }
  }, [fetchUsers])

  // Supprimer un utilisateur
  const deleteUser = useCallback(async (userId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        // Rafraîchir la liste
        await fetchUsers()
        return { success: true }
      } else {
        return { success: false, error: data.error }
      }
    } catch (err) {
      console.error('Error deleting user:', err)
      return { success: false, error: 'Erreur de connexion' }
    }
  }, [fetchUsers])

  // Charger au montage
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return {
    users,
    loading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  }
}
