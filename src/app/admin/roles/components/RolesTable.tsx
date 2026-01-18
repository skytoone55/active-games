'use client'

import { Shield, Users, UserCog, Crown, User, Lock, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import type { Role } from '@/lib/supabase/types'

interface RolesTableProps {
  roles: Role[]
  isDark: boolean
  userLevel: number
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
}

// Icon props type
type IconProps = { className?: string; style?: React.CSSProperties }

// Icon mapping
const ICON_MAP: Record<string, React.ComponentType<IconProps>> = {
  Shield: Shield,
  UserCog: UserCog,
  Users: Users,
  Crown: Crown,
  User: User,
  Lock: Lock
}

function getIconComponent(iconName: string): React.ComponentType<IconProps> {
  return ICON_MAP[iconName] || User
}

export function RolesTable({ roles, isDark, userLevel, onEdit, onDelete }: RolesTableProps) {
  const { t } = useTranslation()

  // Sort roles by level
  const sortedRoles = [...roles].sort((a, b) => a.level - b.level)

  // Check if user can manage a role
  const canManage = (role: Role) => {
    if (role.is_system) return false
    return userLevel < role.level
  }

  if (sortedRoles.length === 0) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {t('admin.roles.no_roles')}
      </div>
    )
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={isDark ? 'bg-gray-700/50' : 'bg-gray-50'}>
              <th className={`px-6 py-4 text-left text-sm font-medium uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {t('admin.roles.table.role')}
              </th>
              <th className={`px-6 py-4 text-left text-sm font-medium uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {t('admin.roles.table.slug')}
              </th>
              <th className={`px-6 py-4 text-center text-sm font-medium uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {t('admin.roles.table.level')}
              </th>
              <th className={`px-6 py-4 text-left text-sm font-medium uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {t('admin.roles.table.description')}
              </th>
              <th className={`px-6 py-4 text-center text-sm font-medium uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {t('admin.roles.table.type')}
              </th>
              <th className={`px-6 py-4 text-right text-sm font-medium uppercase tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {t('admin.roles.table.actions')}
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {sortedRoles.map(role => {
              const Icon = getIconComponent(role.icon)
              const manageable = canManage(role)

              return (
                <tr
                  key={role.id}
                  className={isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: `${role.color}20`,
                        }}
                      >
                        <Icon className="w-5 h-5" style={{ color: role.color }} />
                      </div>
                      <div>
                        <div
                          className="font-medium"
                          style={{ color: role.color }}
                        >
                          {role.display_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={`px-6 py-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <code className={`px-2 py-1 rounded text-sm ${
                      isDark ? 'bg-gray-700' : 'bg-gray-100'
                    }`}>
                      {role.name}
                    </code>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                      role.level === 1
                        ? 'bg-red-500/20 text-red-400'
                        : role.level <= 3
                        ? 'bg-orange-500/20 text-orange-400'
                        : role.level <= 5
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {role.level}
                    </span>
                  </td>
                  <td className={`px-6 py-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {role.description || '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {role.is_system ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'
                      }`}>
                        <Lock className="w-3 h-3" />
                        {t('admin.roles.system')}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                      }`}>
                        {t('admin.roles.custom')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(role)}
                        disabled={!manageable}
                        className={`p-2 rounded-lg transition-colors ${
                          manageable
                            ? isDark
                              ? 'hover:bg-gray-700 text-gray-400 hover:text-blue-400'
                              : 'hover:bg-gray-100 text-gray-500 hover:text-blue-600'
                            : 'opacity-30 cursor-not-allowed'
                        }`}
                        title={manageable ? t('admin.common.edit') : t('admin.roles.cannot_edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(role)}
                        disabled={!manageable}
                        className={`p-2 rounded-lg transition-colors ${
                          manageable
                            ? isDark
                              ? 'hover:bg-gray-700 text-gray-400 hover:text-red-400'
                              : 'hover:bg-gray-100 text-gray-500 hover:text-red-600'
                            : 'opacity-30 cursor-not-allowed'
                        }`}
                        title={manageable ? t('admin.common.delete') : t('admin.roles.cannot_delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
