'use client'

import { useEffect, useRef, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type TableName = 'bookings' | 'orders' | 'contacts' | 'game_sessions' | 'booking_slots' | 'activity_logs' | 'role_permissions' | 'whatsapp_conversations' | 'whatsapp_messages' | 'messenger_conversations' | 'messenger_messages'
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

// Compteur global pour générer des IDs uniques
let channelCounter = 0

/**
 * Hook pour s'abonner aux changements en temps réel sur une table Supabase
 * Utilise des refs pour les callbacks afin d'éviter de recréer la subscription
 * à chaque re-render du parent.
 */
export function useRealtimeSubscription(
  config: SubscriptionConfig,
  enabled: boolean = true
) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isSubscribingRef = useRef(false)

  const { table, event = '*', filter, onInsert, onUpdate, onDelete, onChange } = config

  // Store callbacks in refs so subscription doesn't re-create when callbacks change
  const onChangeRef = useRef(onChange)
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onInsertRef.current = onInsert }, [onInsert])
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])

  useEffect(() => {
    // Ne pas s'abonner si désactivé ou déjà en cours
    if (!enabled || isSubscribingRef.current) {
      return
    }

    const supabase = getClient()

    // Cleanup synchrone du canal précédent
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    isSubscribingRef.current = true

    // Générer un nom de channel unique avec compteur
    const channelId = ++channelCounter
    const channelName = `rt_${table}_${filter || 'all'}_${channelId}`

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
          if (onChangeRef.current) {
            onChangeRef.current(payload)
          }

          switch (payload.eventType) {
            case 'INSERT':
              if (onInsertRef.current) onInsertRef.current(payload)
              break
            case 'UPDATE':
              if (onUpdateRef.current) onUpdateRef.current(payload)
              break
            case 'DELETE':
              if (onDeleteRef.current) onDeleteRef.current(payload)
              break
          }
        }
      )
      .subscribe((status, err) => {
        isSubscribingRef.current = false
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Subscribed to ${table}${filter ? ` with filter ${filter}` : ''}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Realtime] Error subscribing to ${table}`, err)
        } else if (status === 'TIMED_OUT') {
          console.error(`[Realtime] Timeout subscribing to ${table}`)
        }
      })

    channelRef.current = channel

    // Cleanup au démontage ou changement de dépendances
    // Only re-subscribe when table/event/filter/enabled change, NOT when callbacks change
    return () => {
      isSubscribingRef.current = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [enabled, table, event, filter])

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      const supabase = getClient()
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [])

  return { unsubscribe }
}

/**
 * Hook simplifié pour rafraîchir automatiquement les données quand une table change
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

  // Callback stable pour onChange
  const handleChange = useCallback(() => {
    console.log(`[Realtime] Change detected in ${table}, refreshing...`)
    onRefreshRef.current()
  }, [table])

  // Subscription principale
  useRealtimeSubscription(
    {
      table,
      filter: branchId ? `branch_id=eq.${branchId}` : undefined,
      onChange: handleChange
    },
    !!branchId
  )

  // Subscriptions additionnelles (ex: game_sessions pour bookings)
  // Debounced to 500ms to avoid cascading refreshes from bulk operations
  const additionalDebounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!branchId || !additionalTables?.length) return

    const supabase = getClient()
    const channels: RealtimeChannel[] = []

    additionalTables.forEach((additionalTable) => {
      const channelId = ++channelCounter
      const channelName = `rt_${additionalTable}_related_${channelId}`

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
            // Debounce: wait 500ms before refreshing to batch rapid changes
            if (additionalDebounceRef.current) {
              clearTimeout(additionalDebounceRef.current)
            }
            additionalDebounceRef.current = setTimeout(() => {
              onRefreshRef.current()
            }, 500)
          }
        )
        .subscribe()

      channels.push(channel)
    })

    return () => {
      if (additionalDebounceRef.current) {
        clearTimeout(additionalDebounceRef.current)
      }
      channels.forEach(channel => {
        supabase.removeChannel(channel)
      })
    }
  }, [branchId, additionalTables, table])
}
