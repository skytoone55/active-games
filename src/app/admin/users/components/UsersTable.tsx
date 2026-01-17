'use client'

import { useState } from 'react'
import { User, Mail, Phone, Building2, Edit2, Trash2, Shield, Users as UsersIcon, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react'
import type { UserWithBranches } from '@/lib/supabase/types'
import { CustomSelect } from '../../components/CustomSelect'

interface UsersTableProps {
  users: UserWithBranches[]
  isDark: boolean
  onEdit: (user: UserWithBranches) => void
  onDelete: (user: UserWithBranches) => void
  currentUserId: string
}

export function UsersTable({
  users,
  isDark,
  onEdit,
  onDelete,
  currentUserId,
}: UsersTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [filterBranch, setFilterBranch] = useState<string>('all')
  const [sortField, setSortField] = useState<'name' | 'role' | 'phone'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Extraire toutes les branches uniques
  const allBranches = Array.from(
    new Set(users.flatMap(u => u.branches.map(b => b.id)))
  ).map(id => {
    const branch = users.flatMap(u => u.branches).find(b => b.id === id)
    return branch!
  }).filter(Boolean)

  // Filtrer les utilisateurs
  let filteredUsers = users.filter(user => {
    // Filtre par rôle
    if (filterRole !== 'all' && user.role !== filterRole) {
      return false
    }

    // Filtre par branche
    if (filterBranch !== 'all' && !user.branches.some(b => b.id === filterBranch)) {
      return false
    }

    // Filtre par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
      const phone = user.phone.toLowerCase()

      return fullName.includes(query) || phone.includes(query)
    }

    return true
  })

  // Trier les utilisateurs
  filteredUsers.sort((a, b) => {
    let compareResult = 0

    if (sortField === 'name') {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase()
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase()
      compareResult = nameA.localeCompare(nameB)
    } else if (sortField === 'role') {
      const roleOrder = { super_admin: 0, branch_admin: 1, agent: 2 }
      compareResult = roleOrder[a.role] - roleOrder[b.role]
    } else if (sortField === 'phone') {
      compareResult = a.phone.localeCompare(b.phone)
    }

    return sortDirection === 'asc' ? compareResult : -compareResult
  })

  const handleSort = (field: 'name' | 'role' | 'phone') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: 'name' | 'role' | 'phone') => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />
  }

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
      {/* Filtres */}
      <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} space-y-4`}>
        {/* Barre de recherche */}
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
          <input
            type="text"
            placeholder="Rechercher par nom ou téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
        </div>

        {/* Filtres en ligne */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Filtre par rôle */}
          <div className="flex-1">
            <CustomSelect
              value={filterRole}
              onChange={setFilterRole}
              options={[
                { value: 'all', label: 'Tous les rôles' },
                { value: 'super_admin', label: 'Super Admin' },
                { value: 'branch_admin', label: 'Admin Agence' },
                { value: 'agent', label: 'Agent' },
              ]}
              placeholder="Filtrer par rôle"
              isDark={isDark}
            />
          </div>

          {/* Filtre par branche */}
          <div className="flex-1">
            <CustomSelect
              value={filterBranch}
              onChange={setFilterBranch}
              options={[
                { value: 'all', label: 'Toutes les branches' },
                ...allBranches.map(b => ({ value: b.id, label: b.name }))
              ]}
              placeholder="Filtrer par branche"
              isDark={isDark}
            />
          </div>
        </div>

        {/* Compteur */}
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''}
          {(searchQuery || filterRole !== 'all' || filterBranch !== 'all') && ` (sur ${users.length} total)`}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
            <tr>
              <th
                onClick={() => handleSort('name')}
                className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-80 transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center">
                  Utilisateur
                  {getSortIcon('name')}
                </div>
              </th>
              <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Email
              </th>
              <th
                onClick={() => handleSort('phone')}
                className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-80 transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center">
                  Téléphone
                  {getSortIcon('phone')}
                </div>
              </th>
              <th
                onClick={() => handleSort('role')}
                className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-opacity-80 transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-gray-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center">
                  Rôle
                  {getSortIcon('role')}
                </div>
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
                <td colSpan={6} className={`px-4 py-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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

                  {/* Email */}
                  <td className="px-4 py-4">
                    <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{user.email || 'N/A'}</span>
                    </div>
                  </td>

                  {/* Téléphone */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>{user.phone}</span>
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
                        className={`p-2 rounded-lg transition-colors ${
                          isDark
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
                        title={user.id === currentUserId ? 'Vous ne pouvez pas vous supprimer vous-même' : 'Supprimer'}
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
