'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Check, X, Loader2, Save, Shield, Users, UserCog, Crown, User, Lock } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import { useRoles } from '@/hooks/useRoles'
import type { RolePermission, UserRole, ResourceType, PermissionSet, Role } from '@/lib/supabase/types'

interface PermissionsTableProps {
  permissions: RolePermission[]
  isDark: boolean
  onSavePermissions: (changes: Array<{ id: string; updates: Partial<PermissionSet> }>) => Promise<boolean>
}

// Resource display order
const RESOURCE_ORDER: ResourceType[] = ['agenda', 'orders', 'clients', 'users', 'logs', 'settings', 'permissions']

// Permission columns
const PERMISSION_COLUMNS: (keyof PermissionSet)[] = ['can_view', 'can_create', 'can_edit', 'can_delete']

// Icon mapping for role icons
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield: Shield,
  UserCog: UserCog,
  Users: Users,
  Crown: Crown,
  User: User,
  Lock: Lock
}

// Get icon component from icon name
function getIconComponent(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] || User
}

// Generate styling from role color
function getRoleStyles(color: string, isDark: boolean) {
  // Convert hex color to RGB for opacity variants
  const hex = color.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  return {
    bgColor: `bg-[${color}]/20`,
    textColor: isDark ? `text-[${color}]` : `text-[${color}]`,
    borderColor: `border-[${color}]/50`,
    style: {
      '--role-color': color,
      '--role-bg': `rgba(${r}, ${g}, ${b}, 0.2)`,
      '--role-border': `rgba(${r}, ${g}, ${b}, 0.5)`,
    } as React.CSSProperties
  }
}

export function PermissionsTable({ permissions, isDark, onSavePermissions }: PermissionsTableProps) {
  const { t } = useTranslation()
  const { roles, loading: rolesLoading, isSystemRole } = useRoles()
  const [saving, setSaving] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)

  // Local state for pending changes
  const [localPermissions, setLocalPermissions] = useState<Map<string, RolePermission>>(new Map())
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<PermissionSet>>>(new Map())

  // Sort roles by level (ascending = highest authority first)
  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => a.level - b.level)
  }, [roles])

  // Select first non-system role by default (or first role)
  useEffect(() => {
    if (!selectedRoleId && sortedRoles.length > 0) {
      // Prefer first non-system role, otherwise take first role
      const defaultRole = sortedRoles.find(r => !r.is_system) || sortedRoles[0]
      setSelectedRoleId(defaultRole.id)
    }
  }, [sortedRoles, selectedRoleId])

  // Get selected role object
  const selectedRole = useMemo(() => {
    return roles.find(r => r.id === selectedRoleId) || null
  }, [roles, selectedRoleId])

  // Initialize local permissions from props
  useEffect(() => {
    const permMap = new Map<string, RolePermission>()
    permissions.forEach(p => permMap.set(p.id, { ...p }))
    setLocalPermissions(permMap)
    setPendingChanges(new Map())
  }, [permissions])

  // Get permission for a specific role and resource
  const getPermission = useCallback((roleName: UserRole, resource: ResourceType): RolePermission | undefined => {
    return Array.from(localPermissions.values()).find(p => p.role === roleName && p.resource === resource)
  }, [localPermissions])

  // Get all permissions for the selected role
  const getPermissionsForRole = useCallback((roleName: UserRole): RolePermission[] => {
    return RESOURCE_ORDER.map(resource => getPermission(roleName, resource)).filter((p): p is RolePermission => p !== undefined)
  }, [getPermission])

  // Handle toggle (local only, no API call)
  const handleToggle = (perm: RolePermission, column: keyof PermissionSet) => {
    // Don't allow editing system role permissions (super_admin)
    if (isSystemRole(perm.role)) return

    const newValue = !perm[column]

    // Update local state
    setLocalPermissions(prev => {
      const updated = new Map(prev)
      const current = updated.get(perm.id)
      if (current) {
        updated.set(perm.id, { ...current, [column]: newValue })
      }
      return updated
    })

    // Track changes
    setPendingChanges(prev => {
      const updated = new Map(prev)
      const existing = updated.get(perm.id) || {}

      // Get original value from permissions prop
      const original = permissions.find(p => p.id === perm.id)
      if (original && original[column] === newValue) {
        // If back to original, remove from pending
        delete existing[column]
        if (Object.keys(existing).length === 0) {
          updated.delete(perm.id)
        } else {
          updated.set(perm.id, existing)
        }
      } else {
        updated.set(perm.id, { ...existing, [column]: newValue })
      }
      return updated
    })
  }

  // Save all pending changes
  const handleSave = async () => {
    if (pendingChanges.size === 0) return

    setSaving(true)
    const changes = Array.from(pendingChanges.entries()).map(([id, updates]) => ({ id, updates }))
    const success = await onSavePermissions(changes)

    if (success) {
      setPendingChanges(new Map())
    }
    setSaving(false)
  }

  const hasChanges = pendingChanges.size > 0
  const isSelectedSystemRole = selectedRole?.is_system === true

  // Loading state
  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
      </div>
    )
  }

  // No roles
  if (sortedRoles.length === 0) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {t('admin.permissions.no_roles')}
      </div>
    )
  }

  // Get icon for selected role
  const RoleIcon = selectedRole ? getIconComponent(selectedRole.icon) : User
  const roleStyles = selectedRole ? getRoleStyles(selectedRole.color, isDark) : null

  return (
    <div className="space-y-6">
      {/* Role Selector Tabs */}
      <div className="flex flex-wrap gap-3">
        {sortedRoles.map(role => {
          const Icon = getIconComponent(role.icon)
          const isSelected = selectedRoleId === role.id
          const isLocked = role.is_system
          const styles = getRoleStyles(role.color, isDark)

          return (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              style={isSelected ? styles.style : undefined}
              className={`
                flex items-center gap-3 px-5 py-3 rounded-xl border-2 transition-all
                ${isSelected
                  ? isDark
                    ? 'border-[color:var(--role-border)]'
                    : 'border-[color:var(--role-border)]'
                  : isDark
                    ? 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750 hover:border-gray-600'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                }
              `}
            >
              <Icon
                className="w-5 h-5"
                style={isSelected ? { color: role.color } : undefined}
              />
              <div className="text-left">
                <div
                  className={`font-medium ${isSelected ? '' : isDark ? 'text-gray-300' : 'text-gray-700'}`}
                  style={isSelected ? { color: role.color } : undefined}
                >
                  {role.display_name}
                </div>
                <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {isLocked ? t('admin.permissions.locked') : `Level ${role.level}`}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected Role Header */}
      {selectedRole && roleStyles && (
        <div
          className="flex items-center gap-4 p-4 rounded-xl border"
          style={{
            ...roleStyles.style,
            backgroundColor: `rgba(${parseInt(selectedRole.color.slice(1, 3), 16)}, ${parseInt(selectedRole.color.slice(3, 5), 16)}, ${parseInt(selectedRole.color.slice(5, 7), 16)}, 0.1)`,
            borderColor: `rgba(${parseInt(selectedRole.color.slice(1, 3), 16)}, ${parseInt(selectedRole.color.slice(3, 5), 16)}, ${parseInt(selectedRole.color.slice(5, 7), 16)}, 0.3)`
          }}
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: `rgba(${parseInt(selectedRole.color.slice(1, 3), 16)}, ${parseInt(selectedRole.color.slice(3, 5), 16)}, ${parseInt(selectedRole.color.slice(5, 7), 16)}, 0.2)`
            }}
          >
            <RoleIcon className="w-6 h-6" style={{ color: selectedRole.color }} />
          </div>
          <div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {selectedRole.display_name}
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {selectedRole.description || t(`admin.permissions.role_description_${selectedRole.name}`, { fallback: `Level ${selectedRole.level}` })}
            </p>
          </div>
          {isSelectedSystemRole && (
            <div className={`ml-auto px-3 py-1 rounded-full text-xs font-medium ${
              isDark ? 'bg-red-500/30 text-red-300' : 'bg-red-100 text-red-700'
            }`}>
              {t('admin.permissions.all_permissions_locked')}
            </div>
          )}
        </div>
      )}

      {/* Permissions Grid */}
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
                  {t('admin.permissions.table.resource')}
                </th>
                {PERMISSION_COLUMNS.map(col => (
                  <th key={col} className={`px-4 py-4 text-center text-sm font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {t(`admin.permissions.table.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {RESOURCE_ORDER.map(resource => {
                const perm = selectedRole ? getPermission(selectedRole.name, resource) : undefined

                return (
                  <tr
                    key={resource}
                    className={isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}
                  >
                    <td className={`px-6 py-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full ${getResourceColor(resource)}`} />
                        <span className="font-medium">
                          {t(`admin.permissions.resources.${resource}`)}
                        </span>
                      </div>
                    </td>
                    {PERMISSION_COLUMNS.map(col => {
                      if (!perm) {
                        return (
                          <td key={col} className={`px-4 py-4 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            -
                          </td>
                        )
                      }

                      const isEnabled = perm[col]
                      const hasChange = pendingChanges.get(perm.id)?.[col] !== undefined

                      return (
                        <td key={col} className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleToggle(perm, col)}
                            disabled={isSelectedSystemRole}
                            className={`
                              w-10 h-10 rounded-lg flex items-center justify-center mx-auto transition-all
                              ${isSelectedSystemRole ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'}
                              ${hasChange ? 'ring-2 ring-blue-500 ring-offset-2 ' + (isDark ? 'ring-offset-gray-800' : 'ring-offset-white') : ''}
                              ${isEnabled
                                ? isDark
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-green-100 text-green-600'
                                : isDark
                                  ? 'bg-gray-700 text-gray-500'
                                  : 'bg-gray-100 text-gray-400'
                              }
                            `}
                            title={isSelectedSystemRole ? t('admin.permissions.super_admin_locked') : ''}
                          >
                            {isEnabled ? (
                              <Check className="w-5 h-5" />
                            ) : (
                              <X className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving || isSelectedSystemRole}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
            ${hasChanges && !isSelectedSystemRole
              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
              : isDark
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {t('admin.permissions.save')}
          {hasChanges && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
              {pendingChanges.size}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

// Helper function for resource colors
function getResourceColor(resource: ResourceType): string {
  const colors: Record<ResourceType, string> = {
    agenda: 'bg-blue-500',
    orders: 'bg-orange-500',
    clients: 'bg-green-500',
    users: 'bg-purple-500',
    logs: 'bg-yellow-500',
    settings: 'bg-pink-500',
    permissions: 'bg-red-500'
  }
  return colors[resource] || 'bg-gray-500'
}
