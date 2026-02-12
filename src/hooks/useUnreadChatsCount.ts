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
  const [msCount, setMsCount] = useState(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

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

      // Fetch both counts in parallel — countOnly returns just { count: N }
      const [waRes, msRes] = await Promise.all([
        fetch(`/api/chat/conversations?${baseParams}`),
        fetch(`/api/chat/messenger-conversations?${baseParams}`)
      ])

      const [waData, msData] = await Promise.all([waRes.json(), msRes.json()])

      setWaCount(waData.count || 0)
      setMsCount(msData.count || 0)
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

  // Listen for changes on WhatsApp conversations & messages (single handler)
  useRealtimeSubscription(
    { table: 'whatsapp_conversations', onChange: handleRealtimeChange },
    true
  )
  useRealtimeSubscription(
    { table: 'whatsapp_messages', onChange: handleRealtimeChange },
    true
  )

  // Listen for changes on Messenger conversations & messages (single handler)
  useRealtimeSubscription(
    { table: 'messenger_conversations', onChange: handleRealtimeChange },
    true
  )
  useRealtimeSubscription(
    { table: 'messenger_messages', onChange: handleRealtimeChange },
    true
  )

  return waCount + msCount
}
