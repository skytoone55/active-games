'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRealtimeRefresh } from './useRealtimeSubscription'
import type { ActivityLogWithRelations, ActionType, TargetType, UserRole } from '@/lib/supabase/types'

interface LogsFilters {
  actionType?: ActionType
  targetType?: TargetType
  userRole?: UserRole
  userId?: string
  branchId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

interface LogsStats {
  total: number
  today: number
  thisWeek: number
  byActionType: Record<string, number>
}

export function useLogs(branchId: string | null, userRole: UserRole) {
  const [logs, setLogs] = useState<ActivityLogWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<LogsStats>({
    total: 0,
    today: 0,
    thisWeek: 0,
    byActionType: {}
  })

  const fetchLogs = useCallback(async (filters?: LogsFilters) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      // For super_admin, don't filter by branch unless explicitly selected
      // For branch_admin, always filter by their branches
      if (branchId && userRole !== 'super_admin') {
        params.append('branch_id', branchId)
      } else if (branchId && filters?.branchId) {
        params.append('branch_id', filters.branchId)
      }

      if (filters?.actionType) params.append('action_type', filters.actionType)
      if (filters?.targetType) params.append('target_type', filters.targetType)
      if (filters?.userRole) params.append('user_role', filters.userRole)
      if (filters?.userId) params.append('user_id', filters.userId)
      if (filters?.dateFrom) params.append('date_from', filters.dateFrom)
      if (filters?.dateTo) params.append('date_to', filters.dateTo)
      if (filters?.search) params.append('search', filters.search)

      const response = await fetch(`/api/logs?${params.toString()}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch logs')
      }

      setLogs(data.logs || [])

      // Calculate stats
      const allLogs = data.logs || []
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(todayStart)
      weekStart.setDate(weekStart.getDate() - 7)

      const byActionType: Record<string, number> = {}
      let today = 0
      let thisWeek = 0

      allLogs.forEach((log: ActivityLogWithRelations) => {
        const logDate = new Date(log.created_at)
        if (logDate >= todayStart) today++
        if (logDate >= weekStart) thisWeek++
        byActionType[log.action_type] = (byActionType[log.action_type] || 0) + 1
      })

      setStats({
        total: allLogs.length,
        today,
        thisWeek,
        byActionType
      })

    } catch (err) {
      console.error('Error fetching logs:', err)
      setError('Erreur lors du chargement des logs')
    } finally {
      setLoading(false)
    }
  }, [branchId, userRole])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Realtime updates for logs
  useRealtimeRefresh('activity_logs', branchId, fetchLogs)

  // Delete logs (super_admin only)
  const deleteLogs = useCallback(async (logIds: string[]): Promise<boolean> => {
    if (userRole !== 'super_admin') {
      setError('Seul un super admin peut supprimer les logs')
      return false
    }

    setError(null)
    try {
      const response = await fetch('/api/logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: logIds })
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete logs')
      }

      await fetchLogs()
      return true
    } catch (err) {
      console.error('Error deleting logs:', err)
      setError('Erreur lors de la suppression des logs')
      return false
    }
  }, [userRole, fetchLogs])

  return {
    logs,
    loading,
    error,
    stats,
    fetchLogs,
    deleteLogs,
    refresh: fetchLogs
  }
}
