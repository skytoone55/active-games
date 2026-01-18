'use client'

import { useEffect, useRef, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type TableName = 'bookings' | 'orders' | 'contacts' | 'game_sessions' | 'booking_slots' | 'activity_logs' | 'role_permissions'
type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

interface SubscriptionConfig {
  table: TableName
  event?: EventType
  filter?: string // ex: "branch_id=eq.xxx"
  onInsert?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onUpdate?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onDelete?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
}

/**
 * Hook pour s'abonner aux changements en temps réel sur une table Supabase
 *
 * @example
 * // S'abonner à tous les changements sur bookings d'une branche
 * useRealtimeSubscription({
 *   table: 'bookings',
 *   filter: `branch_id=eq.${branchId}`,
 *   onChange: () => refetch()
 * })
 *
 * @example
 * // S'abonner uniquement aux insertions
 * useRealtimeSubscription({
 *   table: 'orders',
 *   event: 'INSERT',
 *   filter: `branch_id=eq.${branchId}`,
 *   onInsert: (payload) => console.log('New order:', payload.new)
 * })
 */
export function useRealtimeSubscription(
  config: SubscriptionConfig,
  enabled: boolean = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const configRef = useRef(config)

  // Update config ref when it changes
  useEffect(() => {
    configRef.current = config
  }, [config])

  const subscribe = useCallback(() => {
    if (!enabled) return

    const supabase = getClient()
    const { table, event = '*', filter, onInsert, onUpdate, onDelete, onChange } = configRef.current

    // Générer un nom de channel unique
    const channelName = `realtime:${table}:${filter || 'all'}:${Date.now()}`

    // Configuration pour l'écoute des changements
    const channelConfig: {
      event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
      schema: string
      table: string
      filter?: string
    } = {
      event,
      schema: 'public',
      table,
    }

    if (filter) {
      channelConfig.filter = filter
    }

    const channel = supabase
      .channel(channelName)
      .on(
        // @ts-expect-error - Supabase types are overly strict for postgres_changes
        'postgres_changes',
        channelConfig,
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          // Handler générique pour tout changement
          if (onChange) {
            onChange(payload)
          }

          // Handlers spécifiques par type d'événement
          switch (payload.eventType) {
            case 'INSERT':
              if (onInsert) onInsert(payload)
              break
            case 'UPDATE':
              if (onUpdate) onUpdate(payload)
              break
            case 'DELETE':
              if (onDelete) onDelete(payload)
              break
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to ${table}${filter ? ` with filter ${filter}` : ''}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] Error subscribing to ${table}`)
        }
      })

    channelRef.current = channel
  }, [enabled])

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      const supabase = getClient()
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  useEffect(() => {
    subscribe()
    return () => unsubscribe()
  }, [subscribe, unsubscribe])

  return {
    unsubscribe,
    resubscribe: () => {
      unsubscribe()
      subscribe()
    }
  }
}

/**
 * Hook simplifié pour rafraîchir automatiquement les données quand une table change
 *
 * @example
 * const { bookings, refresh } = useBookings(branchId)
 * useRealtimeRefresh('bookings', branchId, refresh)
 */
export function useRealtimeRefresh(
  table: TableName,
  branchId: string | null,
  onRefresh: () => void | Promise<void>,
  additionalTables?: TableName[]
) {
  const onRefreshRef = useRef(onRefresh)

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  // Subscription principale
  useRealtimeSubscription(
    {
      table,
      filter: branchId ? `branch_id=eq.${branchId}` : undefined,
      onChange: () => {
        console.log(`[Realtime] Change detected in ${table}, refreshing...`)
        onRefreshRef.current()
      }
    },
    !!branchId
  )

  // Subscriptions additionnelles (ex: game_sessions pour bookings)
  useEffect(() => {
    if (!branchId || !additionalTables?.length) return

    const supabase = getClient()
    const channels: RealtimeChannel[] = []

    additionalTables.forEach(additionalTable => {
      const channelName = `realtime:${additionalTable}:related:${Date.now()}`

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes' as const,
          {
            event: '*' as const,
            schema: 'public' as const,
            table: additionalTable,
          },
          () => {
            console.log(`[Realtime] Change detected in ${additionalTable}, refreshing ${table}...`)
            onRefreshRef.current()
          }
        )
        .subscribe()

      channels.push(channel)
    })

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel)
      })
    }
  }, [branchId, additionalTables, table])
}
