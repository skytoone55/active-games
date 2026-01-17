'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, AlertCircle, Trash2, Shield } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { useBranches } from '@/hooks/useBranches'
import { AdminHeader } from '../components/AdminHeader'
import { UsersTable } from './components/UsersTable'
import { CreateUserModal } from './components/CreateUserModal'
import { EditUserModal } from './components/EditUserModal'
import { EditSelfModal } from './components/EditSelfModal'
import type { UserWithBranches } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'

export default function UsersPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { branches, selectedBranch, selectBranch, loading: branchesLoading } = useBranches()
  const { users, loading: usersLoading, error, createUser, updateUser, deleteUser } = useUsers()
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showEditSelfModal, setShowEditSelfModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserWithBranches | null>(null)

  // Gérer le thème (synchronisé avec localStorage) - EXACTEMENT comme clients
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

  // Rediriger si pas authentifié
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

  const handleEdit = (editUser: UserWithBranches) => {
    if (!user) return
    setSelectedUser(editUser)
    // Si l'utilisateur édite son propre compte, ouvrir le modal simplifié
    if (editUser.id === user.id) {
      setShowEditSelfModal(true)
    } else {
      setShowEditModal(true)
    }
  }

  const handleDelete = (user: UserWithBranches) => {
    setSelectedUser(user)
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    if (!selectedUser) return

    const result = await deleteUser(selectedUser.id)
    
    if (result.success) {
      setShowDeleteConfirm(false)
      setSelectedUser(null)
    } else {
      alert(result.error || 'Erreur lors de la suppression')
    }
  }

  // Vérifier les permissions
  if (user && user.role !== 'super_admin' && user.role !== 'branch_admin') {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Accès refusé
          </h1>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Vous n'avez pas les permissions nécessaires.
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
      {/* Header avec navigation */}
      <AdminHeader
        user={user}
        branches={branches}
        selectedBranch={selectedBranch}
        onBranchSelect={selectBranch}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Sous-header avec titre et actions */}
      <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-purple-500/20' : 'bg-purple-100'
            }`}>
              <Shield className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Gestion des utilisateurs
              </h1>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Gérez les accès et les permissions des utilisateurs
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isDark
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Plus className="w-5 h-5" />
            Créer un utilisateur
          </button>
        </div>
      </div>

      {/* Contenu principal */}
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
        {usersLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {/* Table */}
        {!usersLoading && (
          <UsersTable
            users={users}
            isDark={isDark}
            onEdit={handleEdit}
            onDelete={handleDelete}
            currentUserId={user.id}
          />
        )}
      </div>

      {/* Modals */}
      {user && (
        <>
          <CreateUserModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSubmit={createUser}
            branches={user.branches}
            currentUserRole={user.role || 'agent'}
            currentUserBranchIds={user.branches.map(b => b.id)}
            isDark={isDark}
          />

          <EditSelfModal
            isOpen={showEditSelfModal}
            onClose={() => {
              setShowEditSelfModal(false)
              setSelectedUser(null)
            }}
            onSubmit={updateUser}
            user={selectedUser}
            isDark={isDark}
          />

          <EditUserModal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false)
              setSelectedUser(null)
            }}
            onSubmit={updateUser}
            user={selectedUser}
            branches={user.branches}
            currentUserRole={user.role || 'agent'}
            currentUserBranchIds={user.branches.map(b => b.id)}
            isDark={isDark}
          />
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Supprimer l'utilisateur ?
                  </h2>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {selectedUser.first_name} {selectedUser.last_name}
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
                      Action irréversible
                    </p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                      Le compte et tous les accès de cet utilisateur seront définitivement supprimés.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 p-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setSelectedUser(null)
                }}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isDark
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
