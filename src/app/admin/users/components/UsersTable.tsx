'use client'

import { useState } from 'react'
import { User, Mail, Phone, Building2, Edit2, Trash2, Shield, Users as UsersIcon } from 'lucide-react'
import type { UserWithBranches } from '@/lib/supabase/types'

interface UsersTableProps {
  users: UserWithBranches[]
  isDark: boolean
  onEdit: (user: UserWithBranches) => void
  onDelete: (user: UserWithBranches) => void
  currentUserId: string // Pour empêcher la suppression/modification de soi-même
}

export function UsersTable({
  users,
  isDark,
  onEdit,
  onDelete,
  currentUserId,
}: UsersTableProps) {
  const [selectedRole, setSelectedRole] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Filtrer les utilisateurs
  const filteredUsers = users.filter(user => {
    // Filtre par rôle
    if (selectedRole !== 'all' && user.role !== selectedRole) {
      return false
    }

    // Filtre par recherche (nom, prénom, email, téléphone)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
      const email = user.id.toLowerCase() // L'email est l'ID dans Supabase Auth
      const phone = user.phone.toLowerCase()

      return fullName.includes(query) || email.includes(query) || phone.includes(query)
    }

    return true
  })

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
            <Shield className="w-3 h-3" />
            Super Admin
          </span>
        )
      case 'branch_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
            <Building2 className="w-3 h-3" />
            Admin Agence
          </span>
        )
      case 'agent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <UsersIcon className="w-3 h-3" />
            Agent
          </span>
        )
      default:
        return role
    }
  }

  return (
    <div className={`rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      {/* Header avec filtres */}
      <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Recherche */}
          <input
            type="text"
            placeholder="Rechercher (nom, email, téléphone)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`flex-1 px-3 py-2 rounded-lg border ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />

          {/* Filtre par rôle */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className={`px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDark
                ? 'border-gray-600 text-white'
                : 'border-gray-300 text-gray-900'
            }`}
          >
            <option value="all">Tous les rôles</option>
            <option value="super_admin">Super Admin</option>
            <option value="branch_admin">Admin Agence</option>
            <option value="agent">Agent</option>
          </select>
        </div>

        {/* Compteur */}
        <div className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}
          {searchQuery || selectedRole !== 'all' ? ` (sur ${users.length} total)` : ''}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Utilisateur
              </th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Contact
              </th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Rôle
              </th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Branche(s)
              </th>
              <th className={`px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className={`px-4 py-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Aucun utilisateur trouvé
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className={`${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} transition-colors`}
                >
                  {/* Utilisateur */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        user.role === 'super_admin'
                          ? 'bg-purple-100 dark:bg-purple-900/30'
                          : user.role === 'branch_admin'
                          ? 'bg-blue-100 dark:bg-blue-900/30'
                          : 'bg-green-100 dark:bg-green-900/30'
                      }`}>
                        <User className={`w-5 h-5 ${
                          user.role === 'super_admin'
                            ? 'text-purple-600 dark:text-purple-400'
                            : user.role === 'branch_admin'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-green-600 dark:text-green-400'
                        }`} />
                      </div>
                      <div>
                        <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {user.first_name} {user.last_name}
                        </div>
                        {user.creator && (
                          <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Créé par {user.creator.first_name} {user.creator.last_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span>{user.phone}</span>
                      </div>
                    </div>
                  </td>

                  {/* Rôle */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getRoleBadge(user.role)}
                  </td>

                  {/* Branches */}
                  <td className="px-4 py-4">
                    {user.branches.length === 0 ? (
                      <span className={`text-sm italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Aucune branche
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.branches.map((branch) => (
                          <span
                            key={branch.id}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${
                              isDark
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            <Building2 className="w-3 h-3" />
                            {branch.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(user)}
                        disabled={user.id === currentUserId && user.role === 'super_admin'}
                        className={`p-2 rounded-lg transition-colors ${
                          user.id === currentUserId && user.role === 'super_admin'
                            ? 'opacity-50 cursor-not-allowed'
                            : isDark
                            ? 'hover:bg-gray-600 text-gray-400 hover:text-white'
                            : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                        }`}
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(user)}
                        disabled={user.id === currentUserId}
                        className={`p-2 rounded-lg transition-colors ${
                          user.id === currentUserId
                            ? 'opacity-50 cursor-not-allowed'
                            : isDark
                            ? 'hover:bg-red-900/30 text-gray-400 hover:text-red-400'
                            : 'hover:bg-red-50 text-gray-500 hover:text-red-600'
                        }`}
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
