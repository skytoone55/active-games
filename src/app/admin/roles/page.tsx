'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, AlertCircle, Crown, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRoles } from '@/hooks/useRoles'
import { useBranches } from '@/hooks/useBranches'
import { useTranslation } from '@/contexts/LanguageContext'
import { AdminHeader } from '../components/AdminHeader'
import { RolesTable } from './components/RolesTable'
import { RoleModal } from './components/RoleModal'
import type { Role } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

export default function RolesPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, loading: authLoading } = useAuth()
  const { branches, selectedBranch, selectBranch, loading: branchesLoading } = useBranches()
  const { roles, loading: rolesLoading, error, refresh: refreshRoles, getRoleLevel } = useRoles()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [deleteUserCount, setDeleteUserCount] = useState(0)

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    const savedTheme = localStorage.getItem('admin_theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('admin_theme', newTheme)
  }

  const isDark = theme === 'dark'

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/admin/login')
    }
  }, [user, authLoading, router])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  // Get user level for hierarchy checks
  const userLevel = user?.role ? getRoleLevel(user.role) : 10

  const handleEdit = (role: Role) => {
    setSelectedRole(role)
    setShowEditModal(true)
  }

  const handleDelete = async (role: Role) => {
    // Premier appel pour vérifier si des utilisateurs ont ce rôle
    try {
      const response = await fetch(`/api/roles/${role.id}`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        refreshRoles()
      } else if (data.requires_confirmation) {
        // Des utilisateurs ont ce rôle, afficher le popup de confirmation
        setSelectedRole(role)
        setDeleteUserCount(data.users_count || 0)
        setShowDeleteConfirm(true)
      } else {
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch {
      alert('Erreur de connexion')
    }
  }

  const handleConfirmDelete = async () => {
    if (!selectedRole) return

    try {
      const response = await fetch(`/api/roles/${selectedRole.id}?force_remove=true`, {
        method: 'DELETE',
      })
      const data = await response.json()

      if (data.success) {
        refreshRoles()
        setShowDeleteConfirm(false)
        setSelectedRole(null)
        setDeleteUserCount(0)
      } else {
        alert(data.error || 'Erreur lors de la suppression')
      }
    } catch {
      alert('Erreur de connexion')
    }
  }

  const handleCreateRole = async (roleData: Partial<Role>): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData),
      })
      const data = await response.json()

      if (data.success) {
        refreshRoles()
        setShowCreateModal(false)
        return { success: true }
      } else {
        return { success: false, error: data.error }
      }
    } catch {
      return { success: false, error: 'Erreur de connexion' }
    }
  }

  const handleUpdateRole = async (roleId: string, roleData: Partial<Role>) => {
    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData),
      })
      const data = await response.json()

      if (data.success) {
        refreshRoles()
        setShowEditModal(false)
        setSelectedRole(null)
        return { success: true }
      } else {
        return { success: false, error: data.error }
      }
    } catch {
      return { success: false, error: 'Erreur de connexion' }
    }
  }

  // Check permissions - only level < 5 can manage roles
  if (user && userLevel >= 5) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {t('admin.roles.access_denied')}
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            {t('admin.roles.access_denied_message')}
          </p>
        </div>
      </div>
    )
  }

  // Loading state
  if (authLoading || branchesLoading || !user || !selectedBranch) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Header */}
      <AdminHeader
        user={user}
        branches={branches}
        selectedBranch={selectedBranch}
        onBranchSelect={selectBranch}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Sub-header */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-yellow-500/20' : 'bg-yellow-100'
            }`}>
              <Crown className={`w-6 h-6 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {t('admin.roles.title')}
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {t('admin.roles.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t('admin.roles.create')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Error */}
        {error && (
          <div className={`p-4 rounded-lg border flex items-start gap-2 ${
            isDark
              ? 'bg-red-500/10 border-red-500/50 text-red-400'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {rolesLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {/* Table */}
        {!rolesLoading && (
          <RolesTable
            roles={roles}
            isDark={isDark}
            userLevel={userLevel}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Modals */}
      <RoleModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateRole}
        userLevel={userLevel}
        isDark={isDark}
        mode="create"
      />

      <RoleModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedRole(null)
        }}
        onSubmit={(data) => selectedRole ? handleUpdateRole(selectedRole.id, data) : Promise.resolve({ success: false, error: 'No role selected' })}
        role={selectedRole}
        userLevel={userLevel}
        isDark={isDark}
        mode="edit"
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {t('admin.roles.delete_title') || 'Supprimer le rôle'}
                  </h2>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {selectedRole.display_name}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className={`p-4 rounded-lg ${isDark ? 'bg-yellow-900/20 border border-yellow-700' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                      {t('admin.roles.delete_warning') || 'Attention'}
                    </p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                      {deleteUserCount} {t('admin.roles.users_will_lose_access') || `utilisateur(s) vont perdre leur accès au système. Ils seront mis "sans rôle" jusqu'à réassignation.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 p-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setSelectedRole(null)
                  setDeleteUserCount(0)
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                {t('admin.common.cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                {t('admin.roles.confirm_delete') || 'Supprimer quand même'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
