'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { useRealtimeRefresh } from './useRealtimeSubscription'
import { swrFetcher } from '@/lib/swr-fetcher'
import type { Order, OrderStatus, OrderWithRelations } from '@/lib/supabase/types'

interface OrdersStats {
  total: number
  pending: number
  auto_confirmed: number
  manually_confirmed: number
  aborted: number
  cancelled: number
}

export function useOrders(branchId: string | null) {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>(undefined)

  // Build SWR key based on branchId and optional statusFilter
  const swrKey = branchId
    ? `/api/orders?branch_id=${branchId}${statusFilter ? `&status=${statusFilter}` : ''}`
    : null

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean
    orders: OrderWithRelations[]
    pending_count: number
  }>(
    swrKey,
    swrFetcher,
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const orders = data?.orders || []
  const pendingCount = data?.pending_count || 0

  // Calculate stats from data
  const stats = useMemo<OrdersStats>(() => {
    return {
      total: orders.length,
      pending: orders.filter((o: Order) => o.status === 'pending').length,
      auto_confirmed: orders.filter((o: Order) => o.status === 'auto_confirmed').length,
      manually_confirmed: orders.filter((o: Order) => o.status === 'manually_confirmed').length,
      aborted: orders.filter((o: Order) => o.status === 'aborted').length,
      cancelled: orders.filter((o: Order) => o.status === 'cancelled').length,
    }
  }, [orders])

  // Realtime: revalidate SWR cache on changes
  const handleRealtimeRefresh = useCallback(() => {
    mutate()
  }, [mutate])

  useRealtimeRefresh('orders', branchId, handleRealtimeRefresh)

  // fetchOrders with optional statusFilter — updates the SWR key
  const fetchOrders = useCallback(async (newStatusFilter?: OrderStatus) => {
    if (newStatusFilter !== undefined) {
      setStatusFilter(newStatusFilter)
    } else {
      // Just revalidate current data
      await mutate()
    }
  }, [mutate])

  // Cancel an order
  const cancelOrder = useCallback(async (orderId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel order')
      }

      await mutate()
      return true
    } catch (err) {
      console.error('Error cancelling order:', err)
      return false
    }
  }, [mutate])

  // Delete an order
  const deleteOrder = useCallback(async (orderId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete order')
      }

      await mutate()
      return true
    } catch (err) {
      console.error('Error deleting order:', err)
      return false
    }
  }, [mutate])

  return {
    orders,
    loading: isLoading,
    error: error ? 'Erreur lors du chargement des commandes' : null,
    pendingCount,
    stats,
    fetchOrders,
    cancelOrder,
    deleteOrder,
    refresh: fetchOrders
  }
}

// Hook for pending orders count (badge)
export function usePendingOrdersCount(branchId: string | null) {
  const swrKey = branchId
    ? `/api/orders?branch_id=${branchId}&status=pending`
    : null

  const { data, mutate } = useSWR<{
    success: boolean
    orders: OrderWithRelations[]
    pending_count: number
  }>(
    swrKey,
    swrFetcher,
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  )

  // Realtime: revalidate on changes
  const handleRealtimeRefresh = useCallback(() => {
    mutate()
  }, [mutate])

  useRealtimeRefresh('orders', branchId, handleRealtimeRefresh)

  return data?.pending_count || data?.orders?.length || 0
}

/**
 * Hook for unseen aborted orders count (header badge)
 * Listens to 'aborted-orders-changed' event for instant updates
 */
export function useUnseenAbortedOrdersCount(branchId: string | null) {
  const swrKey = branchId
    ? `/api/orders?branch_id=${branchId}&status=aborted`
    : null

  const { data, mutate } = useSWR<{
    success: boolean
    orders: OrderWithRelations[]
    unseen_aborted_count: number
  }>(
    swrKey,
    swrFetcher,
    { revalidateOnFocus: false, dedupingInterval: 15000 }
  )

  // Realtime: revalidate on changes
  const handleRealtimeRefresh = useCallback(() => {
    mutate()
  }, [mutate])

  useRealtimeRefresh('orders', branchId, handleRealtimeRefresh)

  // Listen to local events for instant badge update
  useEffect(() => {
    const handleChange = () => mutate()
    window.addEventListener('aborted-orders-changed', handleChange)
    return () => window.removeEventListener('aborted-orders-changed', handleChange)
  }, [mutate])

  return { count: data?.unseen_aborted_count || 0, refetch: () => mutate() }
}

/**
 * Notify that aborted orders have changed (header badge updates)
 */
export function notifyAbortedOrdersChanged() {
  window.dispatchEvent(new Event('aborted-orders-changed'))
}
