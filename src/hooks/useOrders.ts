'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRealtimeRefresh } from './useRealtimeSubscription'
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
  const [orders, setOrders] = useState<OrderWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [stats, setStats] = useState<OrdersStats>({
    total: 0,
    pending: 0,
    auto_confirmed: 0,
    manually_confirmed: 0,
    aborted: 0,
    cancelled: 0
  })

  // Charger les commandes
  const fetchOrders = useCallback(async (statusFilter?: OrderStatus) => {
    if (!branchId) {
      setOrders([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      let url = `/api/orders?branch_id=${branchId}`
      if (statusFilter) {
        url += `&status=${statusFilter}`
      }

      const response = await fetch(url)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch orders')
      }

      setOrders(data.orders || [])
      setPendingCount(data.pending_count || 0)

      // Calculer les stats
      const allOrders = data.orders || []
      setStats({
        total: allOrders.length,
        pending: allOrders.filter((o: Order) => o.status === 'pending').length,
        auto_confirmed: allOrders.filter((o: Order) => o.status === 'auto_confirmed').length,
        manually_confirmed: allOrders.filter((o: Order) => o.status === 'manually_confirmed').length,
        aborted: allOrders.filter((o: Order) => o.status === 'aborted').length,
        cancelled: allOrders.filter((o: Order) => o.status === 'cancelled').length,
      })

    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('Erreur lors du chargement des commandes')
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Realtime: écouter les changements sur orders
  // Mise à jour instantanée quand une commande est créée/modifiée
  useRealtimeRefresh('orders', branchId, fetchOrders)

  // Annuler une commande
  const cancelOrder = useCallback(async (orderId: string): Promise<boolean> => {
    setError(null)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to cancel order')
      }

      await fetchOrders()
      return true
    } catch (err) {
      console.error('Error cancelling order:', err)
      setError('Erreur lors de l\'annulation')
      return false
    }
  }, [fetchOrders])

  // Supprimer une commande
  const deleteOrder = useCallback(async (orderId: string): Promise<boolean> => {
    setError(null)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete order')
      }

      await fetchOrders()
      return true
    } catch (err) {
      console.error('Error deleting order:', err)
      setError('Erreur lors de la suppression')
      return false
    }
  }, [fetchOrders])

  return {
    orders,
    loading,
    error,
    pendingCount,
    stats,
    fetchOrders,
    cancelOrder,
    deleteOrder,
    refresh: fetchOrders
  }
}

// Hook pour obtenir juste le count des pending (pour le badge)
export function usePendingOrdersCount(branchId: string | null) {
  const [count, setCount] = useState(0)
  const lastBranchIdRef = useRef<string | null>(null)
  const isFetchingRef = useRef(false)

  const fetchCount = useCallback(async () => {
    if (!branchId) {
      setCount(0)
      return
    }

    // Éviter les appels concurrents
    if (isFetchingRef.current) {
      return
    }

    isFetchingRef.current = true
    try {
      const response = await fetch(`/api/orders?branch_id=${branchId}&status=pending`)
      const data = await response.json()
      setCount(data.pending_count || data.orders?.length || 0)
    } catch (err) {
      console.error('Error fetching pending count:', err)
    } finally {
      isFetchingRef.current = false
    }
  }, [branchId])

  // Fetch quand branchId change (avec déduplication)
  useEffect(() => {
    if (branchId === lastBranchIdRef.current) {
      return
    }
    lastBranchIdRef.current = branchId
    fetchCount()
  }, [branchId, fetchCount])

  // Realtime: mise à jour instantanée du badge
  // Remplace le polling de 30 secondes
  useRealtimeRefresh('orders', branchId, fetchCount)

  return count
}

/**
 * Hook pour obtenir le count des commandes aborted non vues (pour le badge header)
 */
export function useUnseenAbortedOrdersCount(branchId: string | null) {
  const [count, setCount] = useState(0)
  const lastBranchIdRef = useRef<string | null>(null)
  const isFetchingRef = useRef(false)

  const fetchCount = useCallback(async () => {
    if (!branchId) {
      setCount(0)
      return
    }

    if (isFetchingRef.current) return
    isFetchingRef.current = true

    try {
      const response = await fetch(`/api/orders?branch_id=${branchId}&status=aborted`)
      const data = await response.json()
      setCount(data.unseen_aborted_count || 0)
    } catch (err) {
      console.error('Error fetching unseen aborted count:', err)
    } finally {
      isFetchingRef.current = false
    }
  }, [branchId])

  useEffect(() => {
    if (branchId === lastBranchIdRef.current) return
    lastBranchIdRef.current = branchId
    fetchCount()
  }, [branchId, fetchCount])

  // Realtime: mise à jour instantanée du badge
  useRealtimeRefresh('orders', branchId, fetchCount)

  return { count, refetch: fetchCount }
}
