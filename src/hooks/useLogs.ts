'use client'

import { useState, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useRealtimeRefresh } from './useRealtimeSubscription'
import { swrFetcher } from '@/lib/swr-fetcher'
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

function buildLogsUrl(branchId: string | null, userRole: UserRole, filters?: LogsFilters): string {
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

  return `/api/logs?${params.toString()}`
}

export function useLogs(branchId: string | null, userRole: UserRole) {
  const [activeFilters, setActiveFilters] = useState<LogsFilters | undefined>(undefined)

  // Build dynamic SWR key based on branchId, userRole, and active filters
  const swrKey = buildLogsUrl(branchId, userRole, activeFilters)

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean
    logs: ActivityLogWithRelations[]
  }>(
    swrKey,
    swrFetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const logs = data?.logs || []

  // Calculate stats from data
  const stats = useMemo<LogsStats>(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 7)

    const byActionType: Record<string, number> = {}
    let today = 0
    let thisWeek = 0

    logs.forEach((log: ActivityLogWithRelations) => {
      const logDate = new Date(log.created_at)
      if (logDate >= todayStart) today++
      if (logDate >= weekStart) thisWeek++
      byActionType[log.action_type] = (byActionType[log.action_type] || 0) + 1
    })

    return {
      total: logs.length,
      today,
      thisWeek,
      byActionType
    }
  }, [logs])

  // Realtime updates for logs - trigger SWR revalidation
  const handleRealtimeRefresh = useCallback(() => {
    mutate()
  }, [mutate])

  useRealtimeRefresh('activity_logs', branchId, handleRealtimeRefresh)

  // fetchLogs with optional filters — updates the SWR key via activeFilters state
  const fetchLogs = useCallback(async (filters?: LogsFilters) => {
    if (filters) {
      setActiveFilters(filters)
    } else {
      // Just revalidate current data
      await mutate()
    }
  }, [mutate])

  // Delete logs (super_admin only)
  const deleteLogs = useCallback(async (logIds: string[]): Promise<boolean> => {
    if (userRole !== 'super_admin') {
      return false
    }

    try {
      const response = await fetch('/api/logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: logIds })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete logs')
      }

      await mutate()
      return true
    } catch (err) {
      console.error('Error deleting logs:', err)
      return false
    }
  }, [userRole, mutate])

  return {
    logs,
    loading: isLoading,
    error: error ? 'Erreur lors du chargement des logs' : null,
    stats,
    fetchLogs,
    deleteLogs,
    refresh: fetchLogs
  }
}
