'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, X, Loader2, Save } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import type { RolePermission, UserRole, ResourceType, PermissionSet } from '@/lib/supabase/types'

interface PermissionsTableProps {
  permissions: RolePermission[]
  isDark: boolean
  onSavePermissions: (changes: Array<{ id: string; updates: Partial<PermissionSet> }>) => Promise<boolean>
}

// Resource display order
const RESOURCE_ORDER: ResourceType[] = ['agenda', 'orders', 'clients', 'users', 'logs', 'settings', 'permissions']

// Role display order
const ROLE_ORDER: UserRole[] = ['super_admin', 'branch_admin', 'agent']

// Permission columns
const PERMISSION_COLUMNS: (keyof PermissionSet)[] = ['can_view', 'can_create', 'can_edit', 'can_delete']

export function PermissionsTable({ permissions, isDark, onSavePermissions }: PermissionsTableProps) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  // Local state for pending changes
  const [localPermissions, setLocalPermissions] = useState<Map<string, RolePermission>>(new Map())
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<PermissionSet>>>(new Map())

  // Initialize local permissions from props
  useEffect(() => {
    const permMap = new Map<string, RolePermission>()
    permissions.forEach(p => permMap.set(p.id, { ...p }))
    setLocalPermissions(permMap)
    setPendingChanges(new Map())
  }, [permissions])

  // Get permission for a specific role and resource
  const getPermission = useCallback((role: UserRole, resource: ResourceType): RolePermission | undefined => {
    return Array.from(localPermissions.values()).find(p => p.role === role && p.resource === resource)
  }, [localPermissions])

  // Handle toggle (local only, no API call)
  const handleToggle = (perm: RolePermission, column: keyof PermissionSet) => {
    // Don't allow editing super_admin permissions
    if (perm.role === 'super_admin') return

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

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border overflow-hidden ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={isDark ? 'bg-gray-700/50' : 'bg-gray-50'}>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {t('admin.permissions.table.resource')}
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {t('admin.permissions.table.role')}
                </th>
                {PERMISSION_COLUMNS.map(col => (
                  <th key={col} className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {t(`admin.permissions.table.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {RESOURCE_ORDER.map((resource, resourceIndex) => (
                ROLE_ORDER.map((role, roleIndex) => {
                  const perm = getPermission(role, resource)
                  const isFirstOfGroup = roleIndex === 0
                  const isLastOfGroup = roleIndex === ROLE_ORDER.length - 1
                  const isSuperAdmin = role === 'super_admin'

                  return (
                    <tr
                      key={`${resource}-${role}`}
                      className={`
                        ${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'}
                        ${isLastOfGroup && resourceIndex < RESOURCE_ORDER.length - 1
                          ? isDark ? 'border-b-2 border-gray-600' : 'border-b-2 border-gray-300'
                          : ''
                        }
                      `}
                    >
                      {isFirstOfGroup ? (
                        <td
                          rowSpan={ROLE_ORDER.length}
                          className={`px-4 py-3 font-medium align-top ${
                            isDark ? 'text-white bg-gray-750' : 'text-gray-900 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${getResourceColor(resource)}`} />
                            {t(`admin.permissions.resources.${resource}`)}
                          </div>
                        </td>
                      ) : null}
                      <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getRoleBadgeClass(role, isDark)
                        }`}>
                          {t(`admin.roles.${role}`)}
                        </span>
                      </td>
                      {PERMISSION_COLUMNS.map(col => {
                        if (!perm) {
                          return (
                            <td key={`${resource}-${role}-${col}`} className={`px-4 py-3 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              -
                            </td>
                          )
                        }

                        const isEnabled = perm[col]
                        const hasChange = pendingChanges.get(perm.id)?.[col] !== undefined

                        return (
                          <td key={`${resource}-${role}-${col}`} className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggle(perm, col)}
                              disabled={isSuperAdmin}
                              className={`
                                w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all
                                ${isSuperAdmin ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'}
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
                              title={isSuperAdmin ? t('admin.permissions.super_admin_locked') : ''}
                            >
                              {isEnabled ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
            ${hasChanges
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

// Helper function for role badge classes
function getRoleBadgeClass(role: UserRole, isDark: boolean): string {
  if (role === 'super_admin') {
    return isDark
      ? 'bg-red-500/20 text-red-400'
      : 'bg-red-100 text-red-800'
  }
  if (role === 'branch_admin') {
    return isDark
      ? 'bg-purple-500/20 text-purple-400'
      : 'bg-purple-100 text-purple-800'
  }
  return isDark
    ? 'bg-blue-500/20 text-blue-400'
    : 'bg-blue-100 text-blue-800'
}
