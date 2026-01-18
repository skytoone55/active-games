'use client'

import React, { useState, useMemo } from 'react'
import {
  Clock,
  User,
  Calendar,
  ChevronUp,
  ChevronDown,
  ChevronDown as FilterIcon,
  X,
  BookOpen,
  ShoppingCart,
  Users,
  Settings,
  Shield,
  Trash2,
  FileText,
  LogIn,
  LogOut,
  Edit,
  PlusCircle,
  XCircle,
  Archive
} from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import type { ActivityLogWithRelations, ActionType, TargetType, UserRole } from '@/lib/supabase/types'

type SortField = 'created_at' | 'action_type' | 'user_name' | 'target_type'
type SortDirection = 'asc' | 'desc'

interface LogsTableProps {
  logs: ActivityLogWithRelations[]
  isDark: boolean
  currentUserRole: UserRole
  onDeleteLogs?: (logIds: string[]) => Promise<boolean>
}

// Filter Dropdown Component (same as OrdersTable)
function FilterDropdown({
  label,
  options,
  value,
  onChange,
  isDark
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  isDark: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const selectedOption = options.find(o => o.value === value)

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: rect.left })
    }
    setIsOpen(!isOpen)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider ${
          value !== 'all'
            ? 'text-blue-500'
            : isDark ? 'text-gray-400' : 'text-gray-600'
        } hover:text-blue-500`}
      >
        {label}
        {value !== 'all' && (
          <span className="text-[10px] bg-blue-500 text-white px-1 rounded">
            {selectedOption?.label}
          </span>
        )}
        <FilterIcon className="w-3 h-3" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className={`fixed z-50 rounded-lg shadow-lg border min-w-[160px] max-h-64 overflow-y-auto ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}
            style={{ top: position.top, left: position.left }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm first:rounded-t-lg last:rounded-b-lg ${
                  value === option.value
                    ? 'bg-blue-500 text-white'
                    : isDark
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500]

export function LogsTable({ logs, isDark, currentUserRole, onDeleteLogs }: LogsTableProps) {
  const { t, locale } = useTranslation()
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set())

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [targetFilter, setTargetFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const getDateLocale = () => {
    switch (locale) {
      case 'he': return 'he-IL'
      case 'en': return 'en-US'
      default: return 'fr-FR'
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Apply filters
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (actionFilter !== 'all' && log.action_type !== actionFilter) return false
      if (targetFilter !== 'all' && log.target_type !== targetFilter) return false
      if (roleFilter !== 'all' && log.user_role !== roleFilter) return false
      return true
    })
  }, [logs, actionFilter, targetFilter, roleFilter])

  // Sort
  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'action_type':
          comparison = a.action_type.localeCompare(b.action_type)
          break
        case 'user_name':
          comparison = (a.user_name || '').localeCompare(b.user_name || '')
          break
        case 'target_type':
          comparison = (a.target_type || '').localeCompare(b.target_type || '')
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredLogs, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(sortedLogs.length / itemsPerPage)
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return sortedLogs.slice(start, start + itemsPerPage)
  }, [sortedLogs, currentPage, itemsPerPage])

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1)
    setSelectedLogs(new Set())
  }, [actionFilter, targetFilter, roleFilter, itemsPerPage])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3 h-3 inline ml-1" />
      : <ChevronDown className="w-3 h-3 inline ml-1" />
  }

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return {
      date: date.toLocaleDateString(getDateLocale(), {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      }),
      time: date.toLocaleTimeString(getDateLocale(), {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const getActionIcon = (action: ActionType) => {
    if (action.includes('created')) return PlusCircle
    if (action.includes('updated')) return Edit
    if (action.includes('deleted')) return Trash2
    if (action.includes('cancelled')) return XCircle
    if (action.includes('archived')) return Archive
    if (action.includes('confirmed')) return Shield
    if (action === 'user_login') return LogIn
    if (action === 'user_logout') return LogOut
    if (action === 'permission_changed') return Shield
    if (action === 'settings_updated') return Settings
    return FileText
  }

  const getActionColor = (action: ActionType) => {
    if (action.includes('created')) return 'text-green-500 bg-green-100 dark:bg-green-900/30'
    if (action.includes('updated') || action.includes('confirmed')) return 'text-blue-500 bg-blue-100 dark:bg-blue-900/30'
    if (action.includes('deleted')) return 'text-red-500 bg-red-100 dark:bg-red-900/30'
    if (action.includes('cancelled') || action.includes('archived')) return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30'
    if (action === 'user_login') return 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900/30'
    if (action === 'user_logout') return 'text-gray-500 bg-gray-100 dark:bg-gray-700'
    if (action === 'permission_changed') return 'text-purple-500 bg-purple-100 dark:bg-purple-900/30'
    return 'text-gray-500 bg-gray-100 dark:bg-gray-700'
  }

  const getTargetIcon = (target: TargetType | null) => {
    switch (target) {
      case 'booking': return BookOpen
      case 'order': return ShoppingCart
      case 'contact': return User
      case 'user': return Users
      case 'settings': return Settings
      case 'log': return FileText
      default: return FileText
    }
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return isDark
          ? 'bg-purple-500/20 text-purple-400'
          : 'bg-purple-100 text-purple-700'
      case 'branch_admin':
        return isDark
          ? 'bg-blue-500/20 text-blue-400'
          : 'bg-blue-100 text-blue-700'
      case 'agent':
        return isDark
          ? 'bg-green-500/20 text-green-400'
          : 'bg-green-100 text-green-700'
      default:
        return isDark
          ? 'bg-gray-500/20 text-gray-400'
          : 'bg-gray-100 text-gray-700'
    }
  }

  // Action type options for filter
  const actionOptions = [
    { value: 'all', label: t('admin.common.all') },
    { value: 'booking_created', label: t('admin.logs.actions.booking_created') },
    { value: 'booking_updated', label: t('admin.logs.actions.booking_updated') },
    { value: 'booking_cancelled', label: t('admin.logs.actions.booking_cancelled') },
    { value: 'booking_deleted', label: t('admin.logs.actions.booking_deleted') },
    { value: 'order_confirmed', label: t('admin.logs.actions.order_confirmed') },
    { value: 'order_cancelled', label: t('admin.logs.actions.order_cancelled') },
    { value: 'order_deleted', label: t('admin.logs.actions.order_deleted') },
    { value: 'contact_created', label: t('admin.logs.actions.contact_created') },
    { value: 'contact_updated', label: t('admin.logs.actions.contact_updated') },
    { value: 'contact_archived', label: t('admin.logs.actions.contact_archived') },
    { value: 'contact_deleted', label: t('admin.logs.actions.contact_deleted') },
    { value: 'user_created', label: t('admin.logs.actions.user_created') },
    { value: 'user_updated', label: t('admin.logs.actions.user_updated') },
    { value: 'user_deleted', label: t('admin.logs.actions.user_deleted') },
    { value: 'user_login', label: t('admin.logs.actions.user_login') },
    { value: 'user_logout', label: t('admin.logs.actions.user_logout') },
    { value: 'permission_changed', label: t('admin.logs.actions.permission_changed') },
    { value: 'settings_updated', label: t('admin.logs.actions.settings_updated') },
    { value: 'log_deleted', label: t('admin.logs.actions.log_deleted') },
  ]

  const targetOptions = [
    { value: 'all', label: t('admin.common.all') },
    { value: 'booking', label: t('admin.logs.targets.booking') },
    { value: 'order', label: t('admin.logs.targets.order') },
    { value: 'contact', label: t('admin.logs.targets.contact') },
    { value: 'user', label: t('admin.logs.targets.user') },
    { value: 'settings', label: t('admin.logs.targets.settings') },
    { value: 'log', label: t('admin.logs.targets.log') },
  ]

  const roleOptions = [
    { value: 'all', label: t('admin.common.all') },
    { value: 'super_admin', label: t('admin.roles.super_admin') },
    { value: 'branch_admin', label: t('admin.roles.branch_admin') },
    { value: 'agent', label: t('admin.roles.agent') },
  ]

  const hasActiveFilters = actionFilter !== 'all' || targetFilter !== 'all' || roleFilter !== 'all'

  const clearAllFilters = () => {
    setActionFilter('all')
    setTargetFilter('all')
    setRoleFilter('all')
  }

  const toggleLogSelection = (logId: string) => {
    const newSelected = new Set(selectedLogs)
    if (newSelected.has(logId)) {
      newSelected.delete(logId)
    } else {
      newSelected.add(logId)
    }
    setSelectedLogs(newSelected)
  }

  const toggleAllSelection = () => {
    if (selectedLogs.size === paginatedLogs.length) {
      setSelectedLogs(new Set())
    } else {
      setSelectedLogs(new Set(paginatedLogs.map(l => l.id)))
    }
  }

  const handleDeleteSelected = async () => {
    if (onDeleteLogs && selectedLogs.size > 0) {
      const confirmed = window.confirm(t('admin.logs.delete_confirm', { count: selectedLogs.size }))
      if (confirmed) {
        const success = await onDeleteLogs(Array.from(selectedLogs))
        if (success) {
          setSelectedLogs(new Set())
        }
      }
    }
  }

  if (logs.length === 0) {
    return (
      <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {t('admin.logs.no_logs')}
      </div>
    )
  }

  return (
    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
      {/* Header with filters */}
      <div className={`grid grid-cols-12 gap-2 px-4 py-3 border-b ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
        {/* Checkbox column */}
        {currentUserRole === 'super_admin' && (
          <div className="col-span-1 flex items-center">
            <input
              type="checkbox"
              checked={selectedLogs.size === paginatedLogs.length && paginatedLogs.length > 0}
              onChange={toggleAllSelection}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
        )}

        <div className={currentUserRole === 'super_admin' ? 'col-span-2' : 'col-span-2'}>
          <button
            onClick={() => handleSort('created_at')}
            className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'} hover:text-blue-500`}
          >
            {t('admin.logs.table.timestamp')}<SortIcon field="created_at" />
          </button>
        </div>
        <div className="col-span-2">
          <FilterDropdown
            label={t('admin.logs.table.action')}
            options={actionOptions}
            value={actionFilter}
            onChange={setActionFilter}
            isDark={isDark}
          />
        </div>
        <div className="col-span-2">
          <button
            onClick={() => handleSort('user_name')}
            className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'} hover:text-blue-500`}
          >
            {t('admin.logs.table.user')}<SortIcon field="user_name" />
          </button>
        </div>
        <div className="col-span-1">
          <FilterDropdown
            label={t('admin.logs.table.role')}
            options={roleOptions}
            value={roleFilter}
            onChange={setRoleFilter}
            isDark={isDark}
          />
        </div>
        <div className="col-span-2">
          <FilterDropdown
            label={t('admin.logs.table.target')}
            options={targetOptions}
            value={targetFilter}
            onChange={setTargetFilter}
            isDark={isDark}
          />
        </div>
        <div className={`${currentUserRole === 'super_admin' ? 'col-span-2' : 'col-span-3'} flex items-center justify-between`}>
          <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {t('admin.logs.table.details')}
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
            >
              <X className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Results counter and delete button */}
      {(hasActiveFilters || selectedLogs.size > 0) && (
        <div className={`px-4 py-2 flex items-center justify-between text-xs ${isDark ? 'bg-gray-800/50 text-gray-400' : 'bg-gray-50 text-gray-500'} border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <span>
            {sortedLogs.length} {t('admin.logs.results')} {t('admin.common.of')} {logs.length} {t('admin.logs.logs_count')}
          </span>
          {currentUserRole === 'super_admin' && selectedLogs.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
            >
              <Trash2 className="w-3 h-3" />
              {t('admin.logs.delete_selected', { count: selectedLogs.size })}
            </button>
          )}
        </div>
      )}

      {/* Rows */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700 min-h-[300px]">
        {paginatedLogs.length === 0 ? (
          <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('admin.logs.no_matching_logs')}
          </div>
        ) : (
          paginatedLogs.map((log) => {
            const ActionIcon = getActionIcon(log.action_type)
            const TargetIcon = getTargetIcon(log.target_type)
            const { date, time } = formatDateTime(log.created_at)
            const actionColor = getActionColor(log.action_type)

            return (
              <div
                key={log.id}
                className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}
              >
                {/* Checkbox */}
                {currentUserRole === 'super_admin' && (
                  <div className="col-span-1 flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedLogs.has(log.id)}
                      onChange={() => toggleLogSelection(log.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Timestamp */}
                <div className={`${currentUserRole === 'super_admin' ? 'col-span-2' : 'col-span-2'} flex items-center gap-2`}>
                  <Clock className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                  <div>
                    <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{date}</div>
                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{time}</div>
                  </div>
                </div>

                {/* Action */}
                <div className="col-span-2">
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${actionColor}`}>
                    <ActionIcon className="w-3 h-3" />
                    <span className="truncate max-w-[120px]">
                      {t(`admin.logs.actions.${log.action_type}`)}
                    </span>
                  </div>
                </div>

                {/* User */}
                <div className="col-span-2">
                  <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {log.user_name || '-'}
                  </span>
                </div>

                {/* Role */}
                <div className="col-span-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${getRoleBadgeColor(log.user_role)}`}>
                    {t(`admin.roles.${log.user_role}`)}
                  </span>
                </div>

                {/* Target */}
                <div className="col-span-2">
                  {log.target_type && (
                    <div className="flex items-center gap-1">
                      <TargetIcon className={`w-3 h-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {t(`admin.logs.targets.${log.target_type}`)}
                      </span>
                      {log.target_name && (
                        <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          ({log.target_name.length > 15 ? log.target_name.substring(0, 15) + '...' : log.target_name})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Details/Branch */}
                <div className={currentUserRole === 'super_admin' ? 'col-span-2' : 'col-span-3'}>
                  {log.branch?.name && (
                    <span className={`text-xs px-2 py-0.5 rounded ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                      {locale === 'en' ? log.branch.name_en || log.branch.name : log.branch.name}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center gap-4">
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {sortedLogs.length} {t('admin.logs.logs_count')}
            {totalPages > 1 && ` • ${t('admin.common.page')} ${currentPage}/${totalPages}`}
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('admin.common.show')}</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className={`px-2 py-1 rounded text-sm border ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-gray-300'
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{t('admin.common.rows')}</span>
          </div>
        </div>

        {/* Page navigation */}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              «
            </button>
            <span className={`px-3 py-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              »
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              »»
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
