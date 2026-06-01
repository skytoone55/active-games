'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRealtimeSubscription } from './useRealtimeSubscription'

/**
 * Hook to get the count of conversations with unread messages (for header badge)
 * Returns the total number of WhatsApp + Messenger conversations that have unread_count > 0
 * Always fetches ALL branches (the badge should show unread across ALL branches)
 *
 * Optimized: uses countOnly API mode + debounces realtime events
 */
export function useUnreadChatsCount(branches: { id: string }[]) {
  const [waCount, setWaCount] = useState(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Messenger (chat du site) est 100% automatisé par Clara : son compteur de
  // non-lus est toujours 0 côté API. On ne requête donc QUE WhatsApp.
  const fetchCounts = useCallback(async () => {
    try {
      const baseParams = new URLSearchParams({
        status: 'active',
        countOnly: 'true',
        countFilter: 'unread',
        branchId: 'all',
        includeUnassigned: 'true',
      })
      if (branches.length > 0) {
        baseParams.set('allowedBranches', branches.map(b => b.id).join(','))
      }

      const waRes = await fetch(`/api/chat/conversations?${baseParams}`)
      const waData = await waRes.json()
      setWaCount(waData.count || 0)
    } catch (error) {
      console.error('[useUnreadChatsCount] Error:', error)
    }
  }, [branches])

  // Initial fetch
  useEffect(() => {
    if (branches.length > 0) {
      fetchCounts()
    }
  }, [fetchCounts, branches.length])

  // Debounced handler for realtime changes — wait 500ms before fetching
  const handleRealtimeChange = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchCounts()
    }, 500)
  }, [fetchCounts])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Refresh counts when tab becomes visible (WebSocket may have disconnected in background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && branches.length > 0) {
        fetchCounts()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchCounts, branches.length])

  // Un message WhatsApp entrant met à jour conversation.unread_count (UPDATE),
  // tout comme le marquage lu/non-lu. Écouter la table des conversations suffit
  // donc pour le badge — inutile de s'abonner à whatsapp_messages (redondant).
  useRealtimeSubscription(
    { table: 'whatsapp_conversations', onChange: handleRealtimeChange },
    true
  )

  return waCount
}
