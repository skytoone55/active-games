'use client'

import { useEffect, useRef, useCallback } from 'react'
import { getClient } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type TableName = 'bookings' | 'orders' | 'contacts' | 'game_sessions' | 'booking_slots' | 'activity_logs' | 'role_permissions' | 'whatsapp_conversations' | 'whatsapp_messages' | 'messenger_conversations' | 'messenger_messages'
type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

type ChangePayload = RealtimePostgresChangesPayload<Record<string, unknown>>

interface SubscriptionConfig {
  table: TableName
  event?: EventType
  filter?: string // ex: "branch_id=eq.xxx"
  onInsert?: (payload: ChangePayload) => void
  onUpdate?: (payload: ChangePayload) => void
  onDelete?: (payload: ChangePayload) => void
  onChange?: (payload: ChangePayload) => void
}

/**
 * Un "listener" porte des refs vers les callbacks du composant abonné, afin que
 * le canal partagé appelle toujours la dernière version des callbacks sans avoir
 * à se ré-abonner.
 */
interface Listener {
  onChangeRef: { current?: (p: ChangePayload) => void }
  onInsertRef: { current?: (p: ChangePayload) => void }
  onUpdateRef: { current?: (p: ChangePayload) => void }
  onDeleteRef: { current?: (p: ChangePayload) => void }
}

interface RegistryEntry {
  channel: RealtimeChannel | null
  listeners: Set<Listener>
  table: TableName
  event: EventType
  filter?: string
  retryTimer: ReturnType<typeof setTimeout> | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Gestionnaire de canaux PARTAGÉS.
// Auparavant chaque appel de hook ouvrait son propre canal Supabase Realtime.
// Sur une seule page (ex: l'agenda + le header) on pouvait avoir ~11 canaux,
// dont plusieurs doublons exacts (même table + même filtre). Chaque canal est
// ré-évalué côté serveur contre CHAQUE modification du WAL → lenteur + quota.
//
// Ici on déduplique : une seule connexion par (table | event | filter), partagée
// entre tous les abonnés. Le canal se ferme quand le dernier abonné part.
// ─────────────────────────────────────────────────────────────────────────────
const registry = new Map<string, RegistryEntry>()
let channelCounter = 0

function keyFor(table: TableName, event: EventType, filter?: string): string {
  return `${table}|${event}|${filter || 'all'}`
}

function buildChannel(key: string, entry: RegistryEntry) {
  const supabase = getClient()
  const channelName = `rt_${entry.table}_${entry.filter || 'all'}_${++channelCounter}`

  const channelConfig: { event: EventType; schema: string; table: string; filter?: string } = {
    event: entry.event,
    schema: 'public',
    table: entry.table,
  }
  if (entry.filter) channelConfig.filter = entry.filter

  const channel = supabase
    .channel(channelName)
    .on(
      // @ts-expect-error - Supabase types are overly strict for postgres_changes
      'postgres_changes',
      channelConfig,
      (payload: ChangePayload) => {
        // Fan-out vers tous les abonnés de cette clé
        entry.listeners.forEach((l) => {
          l.onChangeRef.current?.(payload)
          switch (payload.eventType) {
            case 'INSERT': l.onInsertRef.current?.(payload); break
            case 'UPDATE': l.onUpdateRef.current?.(payload); break
            case 'DELETE': l.onDeleteRef.current?.(payload); break
          }
        })
      }
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') return
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`[Realtime] ${status} on ${entry.table}`, err || '')
        // Reconstruire le canal après un délai, tant qu'il reste des abonnés.
        if (entry.retryTimer) clearTimeout(entry.retryTimer)
        entry.retryTimer = setTimeout(() => {
          const current = registry.get(key)
          if (!current || current.listeners.size === 0) return
          if (current.channel) {
            getClient().removeChannel(current.channel)
            current.channel = null
          }
          current.channel = buildChannel(key, current)
        }, status === 'TIMED_OUT' ? 5000 : 3000)
      }
    })

  return channel
}

/** Abonnement partagé (non-hook). Retourne une fonction de désabonnement. */
function subscribeShared(
  config: { table: TableName; event: EventType; filter?: string },
  listener: Listener
): () => void {
  const key = keyFor(config.table, config.event, config.filter)
  let entry = registry.get(key)

  if (!entry) {
    entry = {
      channel: null,
      listeners: new Set(),
      table: config.table,
      event: config.event,
      filter: config.filter,
      retryTimer: null,
    }
    registry.set(key, entry)
    entry.channel = buildChannel(key, entry)
  }

  entry.listeners.add(listener)

  return () => {
    const e = registry.get(key)
    if (!e) return
    e.listeners.delete(listener)
    if (e.listeners.size === 0) {
      if (e.retryTimer) clearTimeout(e.retryTimer)
      if (e.channel) getClient().removeChannel(e.channel)
      registry.delete(key)
    }
  }
}

/**
 * Hook pour s'abonner aux changements en temps réel sur une table Supabase.
 * Plusieurs hooks sur la même (table | event | filter) partagent un seul canal.
 */
export function useRealtimeSubscription(
  config: SubscriptionConfig,
  enabled: boolean = true
) {
  const { table, event = '*', filter, onInsert, onUpdate, onDelete, onChange } = config

  // Refs vers les callbacks — le canal partagé lit toujours la dernière version.
  const onChangeRef = useRef(onChange)
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  const onDeleteRef = useRef(onDelete)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onInsertRef.current = onInsert }, [onInsert])
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])

  const listenerRef = useRef<Listener>({ onChangeRef, onInsertRef, onUpdateRef, onDeleteRef })

  useEffect(() => {
    if (!enabled) return
    const unsubscribe = subscribeShared({ table, event, filter }, listenerRef.current)
    return unsubscribe
  }, [enabled, table, event, filter])

  const unsubscribe = useCallback(() => {
    // Le désabonnement réel est géré par le cleanup de l'effet ; conservé pour l'API.
  }, [])

  return { unsubscribe }
}

/**
 * Hook simplifié pour rafraîchir automatiquement les données quand une table change.
 * La table principale et les tables additionnelles passent toutes par le
 * gestionnaire de canaux partagés (déduplication automatique).
 */
export function useRealtimeRefresh(
  table: TableName,
  branchId: string | null,
  onRefresh: () => void | Promise<void>,
  additionalTables?: TableName[]
) {
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  const handleChange = useCallback(() => {
    onRefreshRef.current()
  }, [])

  // Subscription principale (filtrée par branche)
  useRealtimeSubscription(
    {
      table,
      filter: branchId ? `branch_id=eq.${branchId}` : undefined,
      onChange: handleChange,
    },
    !!branchId
  )

  // Tables additionnelles (ex: game_sessions/booking_slots pour bookings).
  // Debounce 1s pour regrouper les changements en rafale.
  const additionalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const additionalKey = (additionalTables || []).join(',')

  useEffect(() => {
    if (!branchId || !additionalTables?.length) return

    const debouncedRefresh = () => {
      if (additionalDebounceRef.current) clearTimeout(additionalDebounceRef.current)
      additionalDebounceRef.current = setTimeout(() => {
        onRefreshRef.current()
      }, 1000)
    }

    const noop = { current: undefined }
    const unsubscribers = additionalTables.map((additionalTable) => {
      const tableFilter = (additionalTable === 'booking_slots' || additionalTable === 'game_sessions')
        ? `branch_id=eq.${branchId}`
        : undefined
      return subscribeShared(
        { table: additionalTable, event: '*', filter: tableFilter },
        {
          onChangeRef: { current: debouncedRefresh },
          onInsertRef: noop,
          onUpdateRef: noop,
          onDeleteRef: noop,
        }
      )
    })

    return () => {
      if (additionalDebounceRef.current) clearTimeout(additionalDebounceRef.current)
      unsubscribers.forEach((u) => u())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, additionalKey])
}
